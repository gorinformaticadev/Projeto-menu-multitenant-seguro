// Forced reload to check module loading debug logs v3
import { ValidationPipe } from '@nestjs/common';
import { ModuleRef, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { useContainer } from 'class-validator';
import { SHARED_API_ROUTE_CONTRACT_POLICIES } from '@contracts/api-routes';
import {
  API_CURRENT_VERSION,
  API_DEFAULT_VERSION,
  API_SUPPORTED_VERSIONS,
  API_VERSION_DEPRECATIONS,
  API_VERSIONING_DOCS_PATH,
} from '@contracts/http';
import { ApiVersioningMiddleware } from './common/middleware/api-versioning.middleware';
import {
  createBodyParserErrorMiddleware,
  createContentLengthLimitMiddleware,
  createDynamicBodyParserMiddleware,
  createRequestBodyTimeoutMiddleware,
  PayloadProtectionMiddleware,
} from './common/middleware/payload-protection.middleware';
import { RouteIsolationInterceptor } from './common/interceptors/route-isolation.interceptor';
import { RouteExecutionTimeoutInterceptor } from './common/interceptors/route-execution-timeout.interceptor';
import { RequestTraceMiddleware } from './common/middleware/request-trace.middleware';
import { ResponseProtectionMiddleware } from './common/middleware/response-protection.middleware';
import { RuntimePressureMiddleware } from './common/middleware/runtime-pressure.middleware';
import { AppModule } from './app.module';
import {
  buildSecurityHeadersHelmetOptions,
  createAdditionalSecurityHeadersMiddleware,
  resolveSecurityHeadersSetting,
} from './common/http-security-headers';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { SanitizationPipe } from './common/pipes/sanitization.pipe';
import { SecretManagerService } from './common/services/secret-manager.nest.service';
import { OperationalObservabilityService } from './common/services/operational-observability.service';
import { OperationalLoadSheddingService } from './common/services/operational-load-shedding.service';
import { OperationalRequestQueueService } from './common/services/operational-request-queue.service';
import { RuntimePressureService } from './common/services/runtime-pressure.service';
import { SentryService } from './common/services/sentry.service';
import { validateSecurityConfig } from './common/utils/security.utils';
import { PathsService } from './core/common/paths/paths.service';
import { ConfigResolverService } from './system-settings/config-resolver.service';
import { SettingsRegistry } from './system-settings/settings-registry.service';

async function bootstrap() {
  const requireSecretManager = process.env.REQUIRE_SECRET_MANAGER === 'true';

  try {
    const secretManager = new SecretManagerService();
    await secretManager.initialize();

    if (!secretManager.validateCriticalSecrets()) {
      console.error('Segredos criticos ausentes.');
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Falha ao inicializar Secret Manager:', message);
    if (process.env.NODE_ENV === 'production' || requireSecretManager) {
      process.exit(1);
    }
  }

  const securityValidation = validateSecurityConfig();
  if (!securityValidation.isValid) {
    console.error('Erro de seguranca: configuracao insegura detectada.');
    securityValidation.errors.forEach((error) => console.error(`   - ${error}`));
    process.exit(1);
  }

  if (securityValidation.warnings.length > 0) {
    console.warn('Avisos de seguranca:');
    securityValidation.warnings.forEach((warning) => console.warn(`   - ${warning}`));
  }

  const dynamicModule = await AppModule.register();
  const app = await NestFactory.create<NestExpressApplication>(dynamicModule, {
    bodyParser: false,
  });
  const moduleRef = app.get(ModuleRef);
  const operationalObservabilityService = app.get(OperationalObservabilityService);
  const operationalLoadSheddingService = app.get(OperationalLoadSheddingService);
  const operationalRequestQueueService = app.get(OperationalRequestQueueService);
  const runtimePressureService = app.get(RuntimePressureService);
  const requestTraceMiddleware = new RequestTraceMiddleware();
  const apiVersioningMiddleware = new ApiVersioningMiddleware(operationalObservabilityService);
  const payloadProtectionMiddleware = new PayloadProtectionMiddleware(operationalObservabilityService);
  const responseProtectionMiddleware = new ResponseProtectionMiddleware(operationalObservabilityService);
  const runtimePressureMiddleware = new RuntimePressureMiddleware(
    runtimePressureService,
    operationalObservabilityService,
  );
  const routeExecutionTimeoutInterceptor = new RouteExecutionTimeoutInterceptor(
      operationalObservabilityService,
      operationalLoadSheddingService,
  );
  const routeIsolationInterceptor = new RouteIsolationInterceptor(
    operationalRequestQueueService,
  );
  // Bridge seguro para class-validator:
  // - resolve providers do Nest quando existirem (ex.: IsStrongPasswordConstraint)
  // - deixa class-validator usar fallback interno para constraints inline/nao registradas
  // - usa ModuleRef (nao proxy) para evitar ExceptionsZone fatal do app.get() em token ausente
  useContainer(
    {
      get<T>(token: new (...args: any[]) => T): T | undefined {
        try {
          return moduleRef.get(token, { strict: false });
        } catch {
          return undefined;
        }
      },
    },
    { fallback: true, fallbackOnErrors: true },
  );
  app.setGlobalPrefix('api');

  const isProduction = process.env.NODE_ENV === 'production';
  let securityHeadersEnabled = true;
  let securityHeadersSource = 'default';

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(requestTraceMiddleware.use.bind(requestTraceMiddleware));
  app.use(createContentLengthLimitMiddleware(operationalObservabilityService));
  app.use(createRequestBodyTimeoutMiddleware(operationalObservabilityService));
  app.use(createDynamicBodyParserMiddleware());
  app.use(createBodyParserErrorMiddleware(operationalObservabilityService));
  app.use(payloadProtectionMiddleware.use.bind(payloadProtectionMiddleware));
  app.use(cookieParser());
  app.use(apiVersioningMiddleware.use.bind(apiVersioningMiddleware));
  app.use(runtimePressureMiddleware.use.bind(runtimePressureMiddleware));
  app.use(responseProtectionMiddleware.use.bind(responseProtectionMiddleware));

  app
    .getHttpAdapter()
    .getInstance()
    .get(API_VERSIONING_DOCS_PATH, (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json({
        currentVersion: API_CURRENT_VERSION,
        defaultVersion: API_DEFAULT_VERSION,
        supportedVersions: API_SUPPORTED_VERSIONS,
        deprecations: API_VERSION_DEPRECATIONS,
        routes: SHARED_API_ROUTE_CONTRACT_POLICIES.map((policy) => ({
          id: policy.id,
          patterns: policy.patterns,
          supportedVersions: policy.supportedVersions || API_SUPPORTED_VERSIONS,
        })),
      });
    });

  app.get(SentryService);
  app.useGlobalFilters(new SentryExceptionFilter());

  try {
    const settingsRegistry = app.get(SettingsRegistry);
    const configResolver = app.get(ConfigResolverService);
    const resolvedSecurityHeaders = await resolveSecurityHeadersSetting(
      settingsRegistry,
      configResolver,
      console,
    );

    securityHeadersEnabled = resolvedSecurityHeaders.value;
    securityHeadersSource = resolvedSecurityHeaders.source;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Falha ao resolver security.headers.enabled dinamicamente. Continuando com cabecalhos HTTP extras de seguranca habilitados por compatibilidade. Causa: ${message}`,
    );
  }

  app.use(
    helmet(
      buildSecurityHeadersHelmetOptions({
        isProduction,
        frontendUrl: process.env.FRONTEND_URL,
        enabled: securityHeadersEnabled,
      }),
    ),
  );

  app.use(createAdditionalSecurityHeadersMiddleware(securityHeadersEnabled));

  if (isProduction) {
    // Empty implementation
  }

  const pathsService = app.get(PathsService);
  const logosPath = pathsService.getLogosDir();
  const setLogosHeaders = (res: any) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  };

  app.useStaticAssets(logosPath, {
    prefix: '/logos',
    setHeaders: setLogosHeaders,
  });
  app.useStaticAssets(logosPath, {
    prefix: '/api/logos',
    setHeaders: setLogosHeaders,
  });
  app.useStaticAssets(logosPath, {
    prefix: '/uploads/logos',
    setHeaders: setLogosHeaders,
  });
  app.useStaticAssets(logosPath, {
    prefix: '/api/uploads/logos',
    setHeaders: setLogosHeaders,
  });

  const allowedOrigins = isProduction
    ? [process.env.FRONTEND_URL].filter(Boolean)
    : [
        process.env.FRONTEND_URL,
        'http://127.0.0.1:5000',
        'http://localhost:5000',
        'http://localhost:3000',
      ].filter(Boolean);

  if (isProduction && allowedOrigins.length === 0) {
    console.warn('FRONTEND_URL nao esta definido em producao. O CORS pode bloquear requisicoes legitimas.');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    exposedHeaders: [
      'Content-Type',
      'Content-Length',
      'Content-Encoding',
      'X-Request-Id',
      'X-Trace-Id',
      'Traceparent',
      'X-Total-Count',
      'X-API-Version',
      'X-API-Latest-Version',
      'X-API-Supported-Versions',
      'X-API-Deprecated',
      'Deprecation',
      'Sunset',
      'Link',
      'Warning',
    ],
    maxAge: parseInt(process.env.CORS_MAX_AGE || '', 10) || 86400,
  });

  app.useGlobalPipes(new SanitizationPipe());
  app.useGlobalInterceptors(routeIsolationInterceptor, routeExecutionTimeoutInterceptor);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  if (securityHeadersEnabled) {
    console.warn(
      `Cabecalhos HTTP extras de seguranca habilitados (origem: ${securityHeadersSource})`,
    );
  } else {
    console.warn(
      `Cabecalhos HTTP extras de seguranca desabilitados por configuracao (origem: ${securityHeadersSource})`,
    );
  }
}

bootstrap();
