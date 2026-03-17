import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import { IsStrongPasswordConstraint } from '@core/common/validators/password.validator';
import { SecurityConfigService } from '@core/security-config/security-config.service';
import { ResetPasswordDto } from '../../auth/dto/reset-password.dto';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

describe('Password validation regression contract', () => {
  const securityConfigServiceMock = {
    getPasswordPolicy: jest.fn(),
  };

  const defaultPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: true,
  };

  let moduleRef: TestingModule;
  let pipe: ValidationPipe;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        IsStrongPasswordConstraint,
        {
          provide: SecurityConfigService,
          useValue: securityConfigServiceMock,
        },
      ],
    }).compile();

    useContainer(moduleRef as any, { fallback: true, fallbackOnErrors: true });

    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    securityConfigServiceMock.getPasswordPolicy.mockResolvedValue(defaultPolicy);
  });

  const validateDto = async <T extends object>(metatype: new () => T, payload: unknown) =>
    pipe.transform(payload, {
      type: 'body',
      metatype,
    } as any);

  it('accepts a strong password in update flow', async () => {
    await expect(
      validateDto(UpdateUserDto, {
        password: 'SenhaForte!123',
      }),
    ).resolves.toMatchObject({
      password: 'SenhaForte!123',
    });
  });

  it('rejects a weak password in update flow', async () => {
    await expect(
      validateDto(UpdateUserDto, {
        password: 'fraca',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses dynamic runtime policy changes from the config source', async () => {
    const password = 'SenhaSemEspecial123';

    securityConfigServiceMock.getPasswordPolicy
      .mockResolvedValueOnce({
        ...defaultPolicy,
        requireSpecial: false,
      })
      .mockResolvedValueOnce({
        ...defaultPolicy,
        requireSpecial: true,
      });

    await expect(validateDto(UpdateUserDto, { password })).resolves.toMatchObject({
      password,
    });

    await expect(validateDto(UpdateUserDto, { password })).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(securityConfigServiceMock.getPasswordPolicy).toHaveBeenCalledTimes(2);
  });

  it('allows update when password is omitted', async () => {
    await expect(
      validateDto(UpdateUserDto, {
        name: 'Usuario Teste',
      }),
    ).resolves.toMatchObject({
      name: 'Usuario Teste',
    });

    expect(securityConfigServiceMock.getPasswordPolicy).not.toHaveBeenCalled();
  });

  it('treats empty string as absent only in update flow', async () => {
    const result = (await validateDto(UpdateUserDto, {
      password: '',
      name: 'Usuario Teste',
    })) as UpdateUserDto;

    expect(result.password).toBeUndefined();
    expect(result.name).toBe('Usuario Teste');
    expect(securityConfigServiceMock.getPasswordPolicy).not.toHaveBeenCalled();
  });

  it('keeps create flow strict for empty password', async () => {
    await expect(
      validateDto(CreateUserDto, {
        email: 'user@example.com',
        password: '',
        name: 'Usuario Teste',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps reset flow strict for empty password', async () => {
    await expect(
      validateDto(ResetPasswordDto, {
        token: 'token-123',
        newPassword: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
