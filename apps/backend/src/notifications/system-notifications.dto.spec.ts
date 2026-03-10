import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  ListSystemNotificationsQueryDto,
  ReadAllSystemNotificationsDto,
} from './dto/system-notifications.dto';

describe('System notifications query validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('accepts known pagination and filter query parameters', async () => {
    await expect(
      pipe.transform(
        {
          page: '1',
          limit: '20',
          unreadOnly: 'true',
          severity: 'critical',
        },
        {
          type: 'query',
          metatype: ListSystemNotificationsQueryDto,
        },
      ),
    ).resolves.toEqual({
      page: '1',
      limit: '20',
      unreadOnly: 'true',
      severity: 'critical',
    });
  });

  it('rejects unexpected query parameters', async () => {
    await expect(
      pipe.transform(
        {
          page: '1',
          limit: '20',
          extra: 'blocked',
        },
        {
          type: 'query',
          metatype: ListSystemNotificationsQueryDto,
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts known read-all query parameters', async () => {
    await expect(
      pipe.transform(
        {
          targetRole: 'SUPER_ADMIN',
          targetUserId: 'user-1',
        },
        {
          type: 'query',
          metatype: ReadAllSystemNotificationsDto,
        },
      ),
    ).resolves.toEqual({
      targetRole: 'SUPER_ADMIN',
      targetUserId: 'user-1',
    });
  });
});
