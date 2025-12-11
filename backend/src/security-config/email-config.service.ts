import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailConfigDto, UpdateEmailConfigDto } from './dto/email-config.dto';
import { EmailConfiguration } from '@prisma/client';
import { EmailService } from '../email/email.service';

@Injectable()
export class EmailConfigService {
  private readonly logger = new Logger(EmailConfigService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Get predefined email provider configurations
   */
  getPredefinedProviders() {
    return [
      // Gmail SMTP configurations
      {
        providerName: 'Gmail (SSL/TLS - Port 465)',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        encryption: 'SSL',
        authMethod: 'OAuth2 / SASL',
      },
      {
        providerName: 'Gmail (STARTTLS - Port 587)',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        encryption: 'STARTTLS',
        authMethod: 'OAuth2 / SASL',
      },
      // Hotmail/Outlook SMTP configuration
      {
        providerName: 'Hotmail/Outlook (STARTTLS - Port 587)',
        smtpHost: 'smtp-mail.outlook.com',
        smtpPort: 587,
        encryption: 'STARTTLS',
        authMethod: 'OAuth2 / Modern Auth',
      },
      // Titan Mail SMTP configuration
      {
        providerName: 'Titan Mail (SSL/TLS - Port 465)',
        smtpHost: 'smtp.titan.email',
        smtpPort: 465,
        encryption: 'SSL',
        authMethod: 'LOGIN (usuário/senha)',
      },
    ];
  }

  /**
   * Get active email configuration
   */
  async getActiveConfig(): Promise<EmailConfiguration | null> {
    return this.prisma.emailConfiguration.findFirst({
      where: { isActive: true },
    });
  }



  /**
   * Get all email configurations
   */
  async getAllConfigs(): Promise<EmailConfiguration[]> {
    return this.prisma.emailConfiguration.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new email configuration
   */
  async createConfig(dto: CreateEmailConfigDto, userId: string): Promise<EmailConfiguration> {
    // First deactivate any existing active configuration
    await this.prisma.emailConfiguration.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new configuration and activate it
    return this.prisma.emailConfiguration.create({
      data: {
        ...dto,
        createdBy: userId,
        updatedBy: userId,
        isActive: true,
      },
    });
  }

  /**
   * Update an email configuration
   */
  async updateConfig(id: string, dto: UpdateEmailConfigDto, userId: string): Promise<EmailConfiguration> {
    // If activating this configuration, deactivate others
    if (dto.isActive) {
      await this.prisma.emailConfiguration.updateMany({
        where: { 
          isActive: true,
          NOT: { id },
        },
        data: { isActive: false },
      });
    }

    return this.prisma.emailConfiguration.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });
  }

  /**
   * Delete an email configuration
   */
  async deleteConfig(id: string): Promise<EmailConfiguration> {
    return this.prisma.emailConfiguration.delete({
      where: { id },
    });
  }

  /**
   * Activate an email configuration
   */
  async activateConfig(id: string, userId: string): Promise<EmailConfiguration> {
    // Deactivate all other configurations
    await this.prisma.emailConfiguration.updateMany({
      where: { 
        isActive: true,
        NOT: { id },
      },
      data: { isActive: false },
    });

    // Activate the selected configuration
    return this.prisma.emailConfiguration.update({
      where: { id },
      data: {
        isActive: true,
        updatedBy: userId,
      },
    });
  }

  /**
   * Test email configuration by sending a test email
   */
  async testConfig(email: string, smtpUser: string, smtpPass: string, user: any): Promise<{ success: boolean; message: string }> {
    try {
      // Get active configuration
      const config = await this.getActiveConfig();
      
      if (!config) {
        return { 
          success: false, 
          message: 'Nenhuma configuração de email ativa encontrada' 
        };
      }
      
      // Send test email with credentials
      const sent = await this.emailService.sendTestEmail(
        email,
        user.name || user.email,
        config,
        smtpUser,
        smtpPass
      );
      
      if (sent) {
        this.logger.log(`Test email sent by user ${user.id} to ${email}`);
        return { 
          success: true, 
          message: `Email de teste enviado com sucesso para ${email}` 
        };
      } else {
        return { 
          success: false, 
          message: 'Falha ao enviar email de teste. Verifique as configurações.' 
        };
      }
    } catch (error) {
      this.logger.error('Error testing email configuration:', error);
      return { 
        success: false, 
        message: 'Erro ao testar configuração de email: ' + (error.message || 'Erro desconhecido')
      };
    }
  }
}