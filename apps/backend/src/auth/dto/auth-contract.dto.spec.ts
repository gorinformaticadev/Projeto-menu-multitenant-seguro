import { ArgumentMetadata } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { loginDtoSchema } from './login.dto';
import { refreshTokenDtoSchema } from './refresh-token.dto';

describe('auth contract validation', () => {
  const bodyPipe = new ZodValidationPipe(loginDtoSchema);
  const refreshBodyPipe = new ZodValidationPipe(refreshTokenDtoSchema);

  const bodyMetadata: ArgumentMetadata = {
    type: 'body',
    metatype: undefined,
    data: undefined,
  };

  it('normalizes login payload with the shared auth schema', async () => {
    await expect(
      bodyPipe.transform(
        {
          email: '  ADMIN@EXAMPLE.COM ',
          password: 'secret123',
        },
        bodyMetadata,
      ),
    ).resolves.toEqual({
      email: 'admin@example.com',
      password: 'secret123',
    });
  });

  it('rejects phantom auth fields before reaching the service', async () => {
    expect.assertions(1);

    try {
      await bodyPipe.transform(
        {
          email: 'admin@example.com',
          password: 'secret123',
          severity: 'critical',
        },
        bodyMetadata,
      );
    } catch (error) {
      const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
        message?: string[];
      };
      expect(response?.message).toContain('property severity should not exist');
    }
  });

  it('accepts empty refresh body because the cookie is the source of truth', async () => {
    await expect(refreshBodyPipe.transform({}, bodyMetadata)).resolves.toEqual({});
  });
});
