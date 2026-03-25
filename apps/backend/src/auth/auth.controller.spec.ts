import { AuthController } from './auth.controller';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  TWO_FACTOR_ENROLLMENT_COOKIE_NAME,
} from './auth-cookie.constants';
import { TRUSTED_DEVICE_COOKIE_NAME } from './trusted-device.constants';
import { CSRF_COOKIE_NAME } from '@common/utils/csrf-token.util';

describe('AuthController', () => {
  const authServiceMock = {
    logout: jest.fn(),
  };

  const twoFactorServiceMock = {};
  const emailVerificationServiceMock = {};
  const passwordResetServiceMock = {};
  const securityConfigServiceMock = {};

  const createController = () =>
    new AuthController(
      authServiceMock as any,
      twoFactorServiceMock as any,
      emailVerificationServiceMock as any,
      passwordResetServiceMock as any,
      securityConfigServiceMock as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    authServiceMock.logout.mockResolvedValue({ message: 'Logout realizado com sucesso' });
  });

  it('preserves the trusted-device cookie when logging out', async () => {
    const controller = createController();
    const response = {
      cookie: jest.fn(),
    };
    const request = {
      headers: {
        'user-agent': 'jest',
      },
      user: {
        id: 'user-1',
      },
    };

    await expect(controller.logout({}, request as any, response as any, '127.0.0.1')).resolves.toEqual(
      { message: 'Logout realizado com sucesso' },
    );

    expect(authServiceMock.logout).toHaveBeenCalledWith(
      '',
      'user-1',
      undefined,
      '127.0.0.1',
      'jest',
    );

    const clearedCookies = response.cookie.mock.calls.map(([name]: [string]) => name);

    expect(clearedCookies).toEqual(
      expect.arrayContaining([
        ACCESS_TOKEN_COOKIE_NAME,
        REFRESH_TOKEN_COOKIE_NAME,
        TWO_FACTOR_ENROLLMENT_COOKIE_NAME,
        CSRF_COOKIE_NAME,
      ]),
    );
    expect(clearedCookies).not.toContain(TRUSTED_DEVICE_COOKIE_NAME);
  });
});
