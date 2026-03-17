import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { PrismaService } from '@core/prisma/prisma.service';
import { getPlatformName } from '@core/common/constants/platform.constants';
import { SecurityConfigService } from '@core/security-config/security-config.service';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);
  private isEnabled: boolean;
  private dbConfig: any = null;


  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private securityConfigService: SecurityConfigService
  ) {
    this.isEnabled = false;
  }

  async onModuleInit() {
    // Initialize with database configuration if available
    await this.initializeTransporter();
  }

  /**
   * Initialize transporter with database configuration or fallback to env vars
   */
  private async initializeTransporter() {
    try {
      // Try to get active database configuration
      const result = await this.prisma.emailConfiguration.findFirst({
        where: { isActive: true }
      });
      this.dbConfig = result;

      // Get security config to access SMTP credentials
      const smtpCredentials = await this.securityConfigService.getSmtpCredentials();

      let smtpConfig;

      if (this.dbConfig) {
        // Use database configuration
        this.logger.log('Usando configuração de email do banco de dados');
        smtpConfig = {
          host: this.dbConfig.smtpHost,
          port: this.dbConfig.smtpPort,
          secure: this.dbConfig.encryption === 'SSL', // true for port 465, false for other ports
          tls: this.dbConfig.encryption === 'STARTTLS' || this.dbConfig.encryption === 'TLS' ? {
            rejectUnauthorized: false
          } : undefined,
        };
      } else {
        // Fallback to environment variables
        this.logger.log('Usando configuração de email do arquivo .env');
        smtpConfig = {
          host: this.config.get('SMTP_HOST'),
          port: parseInt(this.config.get('SMTP_PORT', '587')),
          secure: this.config.get('SMTP_SECURE') === 'true',
          tls: {
            rejectUnauthorized: false
          },
        };
      }

      // Check if SMTP is configured
      this.isEnabled = !!smtpConfig.host;

      if (this.isEnabled) {
        // Add authentication if available
        if (smtpCredentials.smtpUsername && smtpCredentials.smtpPassword) {
          // Use database credentials from SecurityConfig (decrypted)
          smtpConfig.auth = {
            user: smtpCredentials.smtpUsername,
            pass: smtpCredentials.smtpPassword,
          };
        } else if (this.config.get('SMTP_USER') && this.config.get('SMTP_PASS')) {
          // Fallback to environment variables
          smtpConfig.auth = {
            user: this.config.get('SMTP_USER'),
            pass: this.config.get('SMTP_PASS'),
          };
        }

        this.transporter = nodemailer.createTransport(smtpConfig);
        this.logger.log('Email service configurado e ativo');
      } else {
        this.logger.warn('Email service desabilitado - SMTP_HOST não configurado');
      }
    } catch (error) {
      this.logger.error('Erro ao inicializar o serviço de email:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Enviar email de verificação
   */
  async sendVerificationEmail(email: string, name: string, token: string, smtpUser?: string, smtpPass?: string): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.warn(`Email de verificação não enviado (serviço desabilitado): ${email}`);
      return false;
    }

    const verificationUrl = `${this.config.get('FRONTEND_URL')}/verify-email?token=${token}`;
    const html = this.getVerificationEmailTemplate(name, verificationUrl);

    // If database configuration is active and credentials are provided, use them
    if (this.dbConfig && smtpUser && smtpPass) {
      return this.sendEmailWithCredentials(
        email,
        `Verifique seu email - ${await getPlatformName()}`,
        html,
        smtpUser,
        smtpPass
      );
    }

    // Otherwise, use the default transporter (environment variables)
    try {
      const platformName = await getPlatformName();
      await this.transporter.sendMail({
        from: `"${this.config.get('EMAIL_FROM_NAME', platformName)}" <${this.config.get('EMAIL_FROM', 'noreply@example.com')}>`,
        to: email,
        subject: `Verifique seu email - ${platformName}`,
        html,
      });

      this.logger.log(`Email de verificação enviado para: ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao enviar email de verificação para ${email}:`, error);
      return false;
    }
  }

  /**
   * Enviar email de recuperação de senha
   */
  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.warn(`Email de recuperação não enviado (serviço desabilitado): ${email}`);
      return false;
    }

    const resetUrl = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;

    const html = this.getPasswordResetEmailTemplate(name, resetUrl);

    try {
      const platformName = await getPlatformName();
      await this.transporter.sendMail({
        from: `"${this.config.get('EMAIL_FROM_NAME', platformName)}" <${this.config.get('EMAIL_FROM', 'noreply@example.com')}>`,
        to: email,
        subject: `Recuperação de senha - ${platformName}`,
        html,
      });

      this.logger.log(`Email de recuperação enviado para: ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao enviar email de recuperação para ${email}:`, error);
      return false;
    }
  }

  /**
   * Enviar alerta de segurança
   */
  async sendSecurityAlert(email: string, name: string, alertType: string, details: string): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.warn(`Alerta de segurança não enviado (serviço desabilitado): ${email}`);
      return false;
    }

    const html = this.getSecurityAlertTemplate(name, alertType, details);

    try {
      const platformName = await getPlatformName();
      await this.transporter.sendMail({
        from: `"${this.config.get('EMAIL_FROM_NAME', platformName)}" <${this.config.get('EMAIL_FROM', 'noreply@example.com')}>`,
        to: email,
        subject: `Alerta de Segurança - ${alertType}`,
        html,
      });

      this.logger.log(`Alerta de segurança enviado para: ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao enviar alerta de segurança para ${email}:`, error);
      return false;
    }
  }

  /**
   * Template de email de verificação
   */
  private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 30px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verificação de Email</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${name}</strong>,</p>
            <p>Obrigado por se cadastrar no nosso sistema! Para completar seu cadastro, precisamos verificar seu endereço de email.</p>
            <p>Clique no botão abaixo para verificar seu email:</p>
            <center>
              <a href="${verificationUrl}" class="button">Verificar Email</a>
            </center>
            <p>Ou copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationUrl}</p>
            <p><strong>Este link expira em 24 horas.</strong></p>
            <p>Se você não se cadastrou no nosso sistema, ignore este email.</p>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de email de recuperação de senha
   */
  private getPasswordResetEmailTemplate(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 30px; background: #DC2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Recuperação de Senha</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${name}</strong>,</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
            <div class="warning">
              ⚠️ <strong>Atenção:</strong> Se você não solicitou a redefinição de senha, ignore este email e entre em contato com o suporte imediatamente.
            </div>
            <p>Clique no botão abaixo para criar uma nova senha:</p>
            <center>
              <a href="${resetUrl}" class="button">Redefinir Senha</a>
            </center>
            <p>Ou copie e cole o link abaixo no seu navegador:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
            <p><strong>Este link expira em 1 hora por segurança.</strong></p>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Template de alerta de segurança
   */
  private getSecurityAlertTemplate(name: string, alertType: string, details: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .alert { background: #FEE2E2; border-left: 4px solid #DC2626; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Alerta de Segurança</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${name}</strong>,</p>
            <p>Detectamos uma atividade relacionada à segurança da sua conta:</p>
            <div class="alert">
              <strong>Tipo:</strong> ${alertType}<br>
              <strong>Detalhes:</strong> ${details}<br>
              <strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}
            </div>
            <p>Se você reconhece esta atividade, nenhuma ação é necessária.</p>
            <p>Se você <strong>não</strong> reconhece esta atividade:</p>
            <ul>
              <li>Altere sua senha imediatamente</li>
              <li>Ative a autenticação de dois fatores (2FA)</li>
              <li>Entre em contato com o suporte</li>
            </ul>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send test email
   */
  async sendTestEmail(email: string, name: string, config: any, smtpUser: string, smtpPass: string): Promise<boolean> {
    this.logger.log(`Iniciando teste de email para: ${email}`);

    // If no credentials provided, try to get from database
    if ((!smtpUser || !smtpPass) && this.prisma) {
      this.logger.log('Buscando credenciais SMTP do banco de dados...');
      try {
        const smtpCredentials = await this.securityConfigService.getSmtpCredentials();
        if (smtpCredentials.smtpUsername && smtpCredentials.smtpPassword) {
          smtpUser = smtpCredentials.smtpUsername;
          smtpPass = smtpCredentials.smtpPassword;
          this.logger.log('Credenciais SMTP encontradas no banco de dados');
        } else {
          this.logger.warn('Credenciais SMTP não encontradas no banco de dados');
        }
      } catch (error) {
        this.logger.error('Erro ao buscar credenciais SMTP do banco:', error);
      }
    }

    if (!smtpUser || !smtpPass) {
      this.logger.error(`Email de teste não enviado - credenciais ausentes para: ${email}`);
      throw new Error('Credenciais SMTP não configuradas. Configure usuário e senha SMTP primeiro.');
    }

    if (!config || !config.smtpHost || !config.smtpPort) {
      this.logger.error('Configuração de email inválida ou ausente');
      throw new Error('Configuração de email não encontrada. Configure um provedor de email primeiro.');
    }

    this.logger.log(`Configuração SMTP: ${config.smtpHost}:${config.smtpPort} (${config.encryption})`);

    try {
      // Create a temporary transporter with the provided credentials
      const transporterConfig: any = {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.encryption === 'SSL', // true for port 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        // Add debug and logger for development
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development',
      };

      // Configure TLS based on encryption type
      if (config.encryption === 'STARTTLS' || config.encryption === 'TLS') {
        transporterConfig.tls = {
          rejectUnauthorized: false, // Allow self-signed certificates in development
          ciphers: 'SSLv3'
        };
      }

      this.logger.log('Criando transporter temporário para teste...');
      const tempTransporter = nodemailer.createTransport(transporterConfig);

      // Verify connection before sending
      this.logger.log('Verificando conexão SMTP...');
      await tempTransporter.verify();
      this.logger.log('✅ Conexão SMTP verificada com sucesso');

      const html = this.getTestEmailTemplate(name, config);

      this.logger.log('Enviando email de teste...');
      const platformName = await getPlatformName();

      const info = await tempTransporter.sendMail({
        from: `"${platformName}" <${smtpUser}>`,
        to: email,
        subject: `Teste de Configuração de Email - ${platformName}`,
        html,
      });

      this.logger.log(`✅ Email de teste enviado com sucesso para: ${email}`);
      this.logger.log(`Message ID: ${info.messageId}`);

      if (info.response) {
        this.logger.log(`SMTP Response: ${info.response}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`❌ Erro detalhado ao enviar email de teste para ${email}:`);
      this.logger.error(`Erro: ${error.message}`);

      if (error.code) {
        this.logger.error(`Código: ${error.code}`);
      }

      if (error.response) {
        this.logger.error(`Resposta SMTP: ${error.response}`);
      }

      // Provide more specific error messages
      let errorMessage = 'Erro ao enviar email de teste: ';

      if (error.code === 'EAUTH') {
        errorMessage += 'Falha na autenticação. Verifique usuário e senha SMTP.';
        if (config.smtpHost?.includes('gmail')) {
          errorMessage += ' Para Gmail, use uma "Senha de app" em vez da senha normal.';
        }
      } else if (error.code === 'ECONNECTION') {
        errorMessage += 'Falha na conexão. Verifique servidor e porta SMTP.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += 'Timeout na conexão. Verifique se a porta não está bloqueada.';
      } else {
        errorMessage += error.message;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Send email with database configuration and provided credentials
   */
  async sendEmailWithCredentials(
    email: string,
    subject: string,
    html: string,
    smtpUser: string,
    smtpPass: string
  ): Promise<boolean> {
    // If no credentials provided, try to get from database
    if ((!smtpUser || !smtpPass) && this.prisma) {
      try {
        const smtpCredentials = await this.securityConfigService.getSmtpCredentials();
        if (smtpCredentials.smtpUsername && smtpCredentials.smtpPassword) {
          smtpUser = smtpCredentials.smtpUsername;
          smtpPass = smtpCredentials.smtpPassword;
        }
      } catch (error) {
        this.logger.warn('Nao foi possivel buscar credenciais SMTP no banco:', error);
      }
    }

    if (!this.dbConfig || !smtpUser || !smtpPass) {
      this.logger.warn(`Email não enviado (configuração ou credenciais ausentes): ${email}`);
      return false;
    }

    try {
      // Create a temporary transporter with the database configuration and provided credentials
      const tempTransporter = nodemailer.createTransport({
        host: this.dbConfig.smtpHost,
        port: this.dbConfig.smtpPort,
        secure: this.dbConfig.encryption === 'SSL', // true for port 465, false for other ports
        tls: this.dbConfig.encryption === 'STARTTLS' || this.dbConfig.encryption === 'TLS' ? {
          rejectUnauthorized: false
        } : undefined,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const platformName = await getPlatformName();

      await tempTransporter.sendMail({
        from: `"${platformName}" <${smtpUser}>`,
        to: email,
        subject: subject,
        html: html,
      });

      this.logger.log(`Email enviado para: ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao enviar email para ${email}:`, error);
      return false;
    }
  }

  /**
   * Template de email de teste
   */
  private getTestEmailTemplate(name: string, config: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .config-details { background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Configuração de Email Confirmada</h1>
          </div>
          <div class="content">
            <p>Olá <strong>${name}</strong>,</p>
            <p>Esta é uma mensagem de teste para confirmar que sua configuração de email está funcionando corretamente.</p>
            
            <div class="config-details">
              <h3>Detalhes da Configuração:</h3>
              <p><strong>Servidor SMTP:</strong> ${config.smtpHost}:${config.smtpPort}</p>
              <p><strong>Criptografia:</strong> ${config.encryption}</p>
              <p><strong>Método de Autenticação:</strong> ${config.authMethod}</p>
            </div>
            
            <p>Se você recebeu este email, sua configuração de email está pronta para uso!</p>
          </div>
          <div class="footer">
            <p>Este é um email automático. Por favor, não responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Refresh transporter with new configuration
   */
  async refreshTransporter() {
    await this.initializeTransporter();
  }
}
