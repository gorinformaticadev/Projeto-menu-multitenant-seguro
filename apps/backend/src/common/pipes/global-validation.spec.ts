import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LoginDto } from '../../auth/dto/login.dto';
import { LogoutDto } from '../../auth/dto/logout.dto';

describe('Global ValidationPipe contract', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('rejects payloads with unexpected fields', async () => {
    await expect(
      pipe.transform(
        {
          refreshToken: 'refresh-token',
          extraField: true,
        },
        {
          type: 'body',
          metatype: LogoutDto,
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid enum values and malformed payloads', async () => {
    await expect(
      pipe.transform(
        {
          email: 'user@example.com',
          password: '123',
        },
        {
          type: 'body',
          metatype: LoginDto,
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
