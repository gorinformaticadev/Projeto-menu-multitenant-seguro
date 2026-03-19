import { ArgumentMetadata } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  systemDashboardQueryDtoSchema,
  updateSystemDashboardLayoutDtoSchema,
} from './system-dashboard.dto';

describe('system-dashboard contract validation', () => {
  const queryPipe = new ZodValidationPipe(systemDashboardQueryDtoSchema);
  const bodyPipe = new ZodValidationPipe(updateSystemDashboardLayoutDtoSchema);

  const queryMetadata: ArgumentMetadata = {
    type: 'query',
    metatype: undefined,
    data: undefined,
  };

  const bodyMetadata: ArgumentMetadata = {
    type: 'body',
    metatype: undefined,
    data: undefined,
  };

  it('accepts the dashboard query params used by the frontend', async () => {
    await expect(
      queryPipe.transform(
        {
          periodMinutes: '60',
          tenantId: 'tenant-a',
          severity: 'all',
        },
        queryMetadata,
      ),
    ).resolves.toEqual({
      periodMinutes: 60,
      tenantId: 'tenant-a',
      severity: 'all',
    });
  });

  it('rejects unknown dashboard query params', async () => {
    expect.assertions(2);

    try {
      await queryPipe.transform(
        {
          periodMinutes: '60',
          tenantId: 'tenant-a',
          severity: 'all',
          unsupported: 'value',
        },
        queryMetadata,
      );
    } catch (error) {
      const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
        message?: string[];
      };
      expect(response?.message).toContain('property unsupported should not exist');
      expect(Array.isArray(response?.message)).toBe(true);
    }
  });

  it('accepts the dashboard layout payload persisted by the frontend', async () => {
    await expect(
      bodyPipe.transform(
        {
          layoutJson: {
            lg: [{ i: 'version', x: 0, y: 0, w: 2, h: 2 }],
          },
          filtersJson: {
            periodMinutes: 30,
            tenantId: 'tenant-a',
            severity: 'critical',
            operationalPinned: true,
            hiddenWidgetIds: ['maintenance'],
          },
        },
        bodyMetadata,
      ),
    ).resolves.toMatchObject({
      filtersJson: {
        periodMinutes: 30,
        tenantId: 'tenant-a',
        severity: 'critical',
        operationalPinned: true,
        hiddenWidgetIds: ['maintenance'],
      },
    });
  });

  it('rejects unexpected nested filter properties', async () => {
    expect.assertions(2);

    try {
      await bodyPipe.transform(
        {
          layoutJson: {},
          filtersJson: {
            periodMinutes: 30,
            unsupported: true,
          },
        },
        bodyMetadata,
      );
    } catch (error) {
      const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
        message?: string[];
      };
      expect(response?.message).toContain('property filtersJson.unsupported should not exist');
      expect(Array.isArray(response?.message)).toBe(true);
    }
  });
});
