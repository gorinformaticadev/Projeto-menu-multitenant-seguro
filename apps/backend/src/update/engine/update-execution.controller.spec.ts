import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '@core/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@core/common/guards/roles.guard';
import { UpdateExecutionController } from './update-execution.controller';

describe('UpdateExecutionController platform boundary', () => {
  const serviceMock = {
    requestExecution: jest.fn(),
    getCurrentExecutionView: jest.fn(),
    getExecutionView: jest.fn(),
    listExecutionSteps: jest.fn(),
  };

  const createController = () => new UpdateExecutionController(serviceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('restringe execucao canonica para SUPER_ADMIN', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, UpdateExecutionController) || [];
    const roles = Reflect.getMetadata(ROLES_KEY, UpdateExecutionController) || [];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    expect(roles).toEqual([Role.SUPER_ADMIN]);
  });

  it('propaga contexto de auditoria ao criar execucao canonica', async () => {
    const controller = createController();
    serviceMock.requestExecution.mockResolvedValue({ id: 'execution-1' });

    await controller.create(
      {
        version: 'v1.2.3',
        mode: 'native',
      } as any,
      {
        user: {
          id: 'super-1',
          email: 'super@example.com',
          role: Role.SUPER_ADMIN,
        },
        requestContext: {
          ip: '10.0.0.1',
          userAgent: 'jest',
        },
        ip: '10.0.0.1',
        headers: {
          'user-agent': 'jest',
        },
      } as any,
    );

    expect(serviceMock.requestExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedBy: 'super-1',
        source: 'panel',
        metadata: expect.objectContaining({
          userRole: Role.SUPER_ADMIN,
        }),
      }),
    );
  });
});
