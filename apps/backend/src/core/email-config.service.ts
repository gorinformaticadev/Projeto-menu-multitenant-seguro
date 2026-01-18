 import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { CreateEmailConfigDto, UpdateEmailConfigDto } from './dto/email-config.dto';
import { EmailConfiguration } from '@prisma/client';

@Injectable()
export class EmailConfigService {
  private readonly logger = new Logger(EmailConfigService.name);

  constructor(
    private prisma: PrismaService,
  ) {
      // Empty implementation
    }

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
        authMethod: 'LOGIN',
        description: 'ConfiguraÃ§Ã£o recomendada para Gmail com SSL/TLS',
      },
      {
        providerName: 'Gmail (STARTTLS - Port 587)',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        encryption: 'STARTTLS',
        authMethod: 'LOGIN',
        description: 'ConfiguraÃ§Ã£o alternativa para Gmail com STARTTLS',
      },
      // Hotmail/Outlook SMTP configuration
      {
        providerName: 'Hotmail/Outlook (STARTTLS - Port 587)',
        smtpHost: 'smtp-mail.outlook.com',
        smtpPort: 587,
        encryption: 'STARTTLS',
        authMethod: 'LOGIN',
        description: 'ConfiguraÃ§Ã£o para Hotmail e Outlook.com',
      },
      // Titan Mail SMTP configuration
      {
        providerName: 'Titan Mail (SSL/TLS - Port 465)',
        smtpHost: 'smtp.titan.email',
        smtpPort: 465,
        encryption: 'SSL',
        authMethod: 'LOGIN',
        description: 'ConfiguraÃ§Ã£o para Titan Email',
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
   * Only one email configuration can exist at a time (replaces the previous one)
   */
  async createConfig(dto: CreateEmailConfigDto, userId: string): Promise<EmailConfiguration> {
    this.logger.log(`Creating new email configuration for user ${userId}`);
    
    // Delete all existing configurations (only one email config allowed)
    const existingConfigs = await this.prisma.emailConfiguration.findMany();
    if (existingConfigs.length > 0) {
      await this.prisma.emailConfiguration.deleteMany({
      // Empty implementation
    });
      this.logger.log(`Deleted ${existingConfigs.length} existing email configurations`);
    }

    // Create new configuration and activate it
    const newConfig = await this.prisma.emailConfiguration.create({
      data: {
        ...dto,
        createdBy: userId,
        updatedBy: userId,
        isActive: true,
      },
    });

    this.logger.log(`Created new email configuration with ID: ${newConfig.id}`);
    return newConfig;
  }

  /**
   * Update an email configuration
   */
  async updateConfig(id: string, dto: UpdateEmailConfigDto, userId: string): Promise<EmailConfiguration> {
    this.logger.log(`Updating email configuration ${id} by user ${userId}`);
    
    // Since only one configuration exists, just update it
    const updatedConfig = await this.prisma.emailConfiguration.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: userId,
        isActive: true, // Always keep it active since it's the only one
      },
    });

    this.logger.log(`Updated email configuration ${id}`);
    return updatedConfig;
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
   * Since only one configuration exists, this just ensures it's active
   */
  async activateConfig(id: string, userId: string): Promise<EmailConfiguration> {
    this.logger.log(`Activating email configuration ${id} by user ${userId}`);
    
    // Since only one configuration exists, just ensure it's active
    const activatedConfig = await this.prisma.emailConfiguration.update({
      where: { id },
      data: {
        isActive: true,
        updatedBy: userId,
      },
    });

    this.logger.log(`Activated email configuration ${id}`);
    return activatedConfig;
  }

  /**
   * Get SMTP credentials from SecurityConfig
   */
  async getSmtpCredentials(): Promise<{ smtpUsername?: string; smtpPassword?: string }> {
    try {
      const securityConfig = await this.prisma.securityConfig.findFirst();
      return {
        smtpUsername: securityConfig?.smtpUsername || undefined,
        smtpPassword: securityConfig?.smtpPassword || undefined,
      };
    } catch (error) {
      this.logger.error('Error fetching SMTP credentials:', error);
      return {
      // Empty implementation
    };
    }
  }

  /**
   * Test email configuration by sending a test email
   * Note: This method now requires the emailService to be passed in
   */
  async testConfig(email: string, smtpUser: string, smtpPass: string, user: any, emailService: unknown): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Testing email configuration for user ${user.id} to ${email}`);
      
      // Get active configuration
      const config = await this.getActiveConfig();
      
      if (!config) {
        this.logger.warn('No active email configuration found');
        return { 
          success: false, 
          message: 'Nenhuma configuraÃ§Ã£o de email ativa encontrada. Configure um provedor de email primeiro.' 
        };
      }
      
      this.logger.log(`Using email configuration: ${config.providerName} (${config.smtpHost}:${config.smtpPort})`);
      
      // Send test email with credentials
      const sent = await emailService.sendTestEmail(
        email,
        user.name || user.email,
        config,
        smtpUser,
        smtpPass
      );
      
      if (sent) {
        this.logger.log(`âœ… Test email sent successfully by user ${user.id} to ${email}`);
        return { 
          success: true, 
          message: `Email de teste enviado com sucesso para ${email}. Verifique sua caixa de entrada.` 
        };
      } else {
        this.logger.warn(`âŒ Failed to send test email to ${email}`);
        return { 
          success: false, 
          message: 'Falha ao enviar email de teste. Verifique as configuraÃ§Ãµes e credenciais.' 
        };
      }
    } catch (error) {
      this.logger.error(`âŒ Error testing email configuration for ${email}:`, error);
      
      // Return the specific error message from the email service
      return { 
        success: false, 
        message: error.message || 'Erro desconhecido ao testar configuraÃ§Ã£o de email'
      };
    }
  }
}
