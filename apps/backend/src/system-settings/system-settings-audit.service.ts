import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SettingDefinition } from './system-settings.types';

export interface SystemSettingsAuditActor {
  userId: string | null;
  email: string | null;
}

export interface CreateSystemSettingAuditParams {
  definition: SettingDefinition;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  actor: SystemSettingsAuditActor;
  changeReason?: string | null;
}

@Injectable()
export class SystemSettingsAuditService {
  async createAuditRecord(
    tx: Prisma.TransactionClient,
    params: CreateSystemSettingAuditParams,
  ): Promise<void> {
    const { actor, changeReason, definition, key, newValue, oldValue } = params;

    await tx.systemSettingAudit.create({
      data: {
        settingKey: key,
        oldValueJson: this.serializeAuditValue(definition, oldValue),
        newValueJson: this.serializeAuditValue(definition, newValue),
        changedByUserId: actor.userId,
        changedByEmail: actor.email,
        changeReason: changeReason?.trim() || null,
      },
    });
  }

  private serializeAuditValue(definition: SettingDefinition, value: unknown): Prisma.InputJsonValue | null {
    if (value === undefined) {
      return null;
    }

    if (definition.sensitive) {
      return {
        masked: true,
      };
    }

    return value as Prisma.InputJsonValue;
  }
}
