import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailConfigDto, UpdateEmailConfigDto, EmailProvider } from './dto/email-config.dto';
import { EmailConfiguration } from '@prisma/client';

@Injectable()
export class EmailConfigService {
  private readonly logger = new Logger(EmailConfigService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get predefined email provider configurations
   */
  getPredefinedProviders() {
    return [
      {
        providerName: EmailProvider.GMAIL,
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        encryption: 'STARTTLS',
        authMethod: 'OAuth 2.0',
      },
      {
        providerName: EmailProvider.HOTMAIL,
        smtpHost: 'smtp-mail.outlook.com',
        smtpPort: 587,
        encryption: 'STARTTLS',
        authMethod: 'OAuth 2.0',
      },
      {
        providerName: EmailProvider.TITAN,
        smtpHost: 'mail.titan.email',
        smtpPort: 587,
        encryption: 'STARTTLS',
        authMethod: 'PLAIN',
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
}