import { Controller, Post, Body, Logger } from '@nestjs/common';

interface CspReportBody {
  'csp-report': {
    'document-uri': string;
    'violated-directive': string;
    'effective-directive': string;
    'original-policy': string;
    'blocked-uri': string;
    'status-code': number;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
  };
}

@Controller('api')
export class CspReportController {
  private readonly logger = new Logger(CspReportController.name);

  @Post('csp-report')
  async handleCspReport(@Body() report: CspReportBody) {
    const cspReport = report['csp-report'];

    // Log da violação
    this.logger.warn('🚨 CSP Violation Detected:', {
      documentUri: cspReport['document-uri'],
      violatedDirective: cspReport['violated-directive'],
      effectiveDirective: cspReport['effective-directive'],
      blockedUri: cspReport['blocked-uri'],
      sourceFile: cspReport['source-file'],
      lineNumber: cspReport['line-number'],
      columnNumber: cspReport['column-number'],
    });

    // Em produção, você pode enviar para Sentry ou outro serviço
    if (process.env.NODE_ENV === 'production') {
      // Exemplo: enviar para Sentry
      // Sentry.captureMessage('CSP Violation', {
      //   level: 'warning',
      //   extra: cspReport,
      // });
    }

    // Retornar 204 No Content (padrão para CSP reports)
    return;
  }
}

