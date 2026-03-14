// Forced reload to check module loading debug logs v3
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import {
  buildSecurityHeadersHelmetOptions,
  createAdditionalSecurityHeadersMiddleware,
  resolveSecurityHeadersSetting,
} from './common/http-security-headers';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import { SanitizationPipe } from './common/pipes/sanitization.pipe';
import { SecretManagerService } from './common/services/secret-manager.nest.service';
import { SentryService } from './common/services/sentry.service';
import { validateSecurityConfig } from './common/utils/security.utils';
import { PathsService } from './core/common/paths/paths.service';
import { ConfigResolverService } from './system-settings/config-resolver.service';
import { SettingsRegistry } from './system-settings/settings-registry.service';

async function bootstrap() {
  const requireSecretManager = process.env.REQUIRE_SECRET_MANAGER === 'true';

  const securityValidation = validateSecurityConfig();
  if (!securityValidation.isValid) {
    console.error('Security error: unsafe configuration detected.');
    securityValidation.errors.forEach((error) => console.error(`   - ${error}`));
    process.exit(1);
  }

  if (securityValidation.warnings.length > 0) {
    console.warn('Security warnings:');
    securityValidation.warnings.forEach((warning) => console.warn(`   - ${warning}`));
  }

  try {
    const secretManager = new SecretManagerService();
    await secretManager.initialize();

    if (!secretManager.validateCriticalSecrets()) {
      console.error('Critical secrets are missing.');
      if (requireSecretManager) {
        process.exit(1);
      }
      console.warn('REQUIRE_SECRET_MANAGER=false: continuing without strict secret validation.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize Secret Manager:', message);
    if (process.env.NODE_ENV === 'production' && requireSecretManager) {
      process.exit(1);
    } else {
      console.warn('Continuing without Secret Manager.');
      if (process.env.NODE_ENV === 'production') {
        console.warn('REQUIRE_SECRET_MANAGER=false: continuing in production without Secret Manager.');
      }
    }
  }

  const dynamicModule = await AppModule.register();
  const app = await NestFactory.create<NestExpressApplication>(dynamicModule);
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  app.setGlobalPrefix('api');

  const isProduction = process.env.NODE_ENV === 'production';
  let securityHeadersEnabled = true;
  let securityHeadersSource = 'default';

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(cookieParser());

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
      `Failed to resolve security.headers.enabled dynamically. Continuing with extra HTTP security headers enabled for compatibility. Cause: ${message}`,
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
    console.warn('FRONTEND_URL is not defined in production. CORS may block legitimate requests.');
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    exposedHeaders: [
      'Content-Type',
      'Content-Length',
      'X-Total-Count',
      'X-API-Deprecated',
      'Deprecation',
      'Link',
      'Warning',
    ],
    maxAge: parseInt(process.env.CORS_MAX_AGE || '', 10) || 86400,
  });

  app.useGlobalPipes(new SanitizationPipe());

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
      `Extra HTTP security headers enabled (source: ${securityHeadersSource})`,
    );
  } else {
    console.warn(
      `Extra HTTP security headers disabled by configuration (source: ${securityHeadersSource})`,
    );
  }
}

bootstrap();
