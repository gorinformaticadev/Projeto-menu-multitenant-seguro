import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SmtpCredentials } from '@prisma/client';

@Injectable()
export class SmtpCredentialsService {
  private readonly logger = new Logger(SmtpCredentialsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get SMTP credentials
   */
  async getCredentials(): Promise<SmtpCredentials | null> {
    return this.prisma.smtpCredentials.findFirst();
  }

  /**
   * Save SMTP credentials
   */
  async saveCredentials(smtpUser: string, smtpPass: string): Promise<SmtpCredentials> {
    // Check if credentials already exist
    const existing = await this.prisma.smtpCredentials.findFirst();
    
    if (existing) {
      // Update existing credentials
      return this.prisma.smtpCredentials.update({
        where: { id: existing.id },
        data: {
          smtpUser,
          smtpPass,
        },
      });
    } else {
      // Create new credentials
      return this.prisma.smtpCredentials.create({
        data: {
          smtpUser,
          smtpPass,
        },
      });
    }
  }

  /**
   * Delete SMTP credentials
   */
  async deleteCredentials(): Promise<SmtpCredentials> {
    const existing = await this.prisma.smtpCredentials.findFirst();
    
    if (existing) {
      return this.prisma.smtpCredentials.delete({
        where: { id: existing.id },
      });
    }
    
    throw new Error('No SMTP credentials found to delete');
  }
}