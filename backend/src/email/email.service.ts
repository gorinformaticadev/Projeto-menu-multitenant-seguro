import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: Transporter;
  private readonly logger = new Logger(EmailService.name);
  private isEnabled: boolean;
  private dbConfig: any = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService
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

      let smtpConfig;
      
      if (this.dbConfig) {
        // Use database configuration
        this.logger.log('Usando configuração de email do banco de dados');
        smtpConfig = {
          host: this.dbConfig.smtpHost,
          port: this.dbConfig.smtpPort,
          secure: this.dbConfig.encryption === 'SSL' || this.dbConfig.encryption === 'TLS',
        };
      } else {
        // Fallback to environment variables
        this.logger.log('Usando configuração de email do arquivo .env');
        smtpConfig = {
          host: this.config.get('SMTP_HOST'),
          port: parseInt(this.config.get('SMTP_PORT', '587')),
          secure: this.config.get('SMTP_SECURE') === 'true',
        };
      }

      // Check if SMTP is configured
      this.isEnabled = !!smtpConfig.host;

      if (this.isEnabled) {
        // Add authentication if available
        if (this.dbConfig) {
          // For database config, auth will be provided when sending emails
          // This is a placeholder - actual credentials would need to be provided separately
          smtpConfig.auth = {
            user: this.config.get('SMTP_USER'), // Still using env var for credentials
            pass: this.config.get('SMTP_PASS'),
          };
        } else {
          // For env config, use env vars for auth
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
  async sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.warn(`Email de verificação não enviado (serviço desabilitado): ${email}`);
      return false;
    }

    const verificationUrl = `${this.config.get('FRONTEND_URL')}/verify-email?token=${token}`;

    const html = this.getVerificationEmailTemplate(name, verificationUrl);

    try {
      await this.transporter.sendMail({
        from: `"${this.config.get('EMAIL_FROM_NAME', 'Sistema Multitenant')}" <${this.config.get('EMAIL_FROM', 'noreply@example.com')}>`,
        to: email,
        subject: 'Verifique seu email - Sistema Multitenant',
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
      await this.transporter.sendMail({
        from: `"${this.config.get('EMAIL_FROM_NAME', 'Sistema Multitenant')}" <${this.config.get('EMAIL_FROM', 'noreply@example.com')}>`,
        to: email,
        subject: 'Recuperação de senha - Sistema Multitenant',
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
      await this.transporter.sendMail({
        from: `"${this.config.get('EMAIL_FROM_NAME', 'Sistema Multitenant')}" <${this.config.get('EMAIL_FROM', 'noreply@example.com')}>`,
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
   * Refresh transporter with new configuration
   */
  async refreshTransporter() {
    await this.initializeTransporter();
  }
}
