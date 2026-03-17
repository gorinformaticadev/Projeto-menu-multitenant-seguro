import { UnauthorizedException } from '@nestjs/common';

export class TwoFactorRequiredException extends UnauthorizedException {
  constructor(
    message: string,
    public readonly clearTrustedDeviceCookie: boolean,
  ) {
    super(message);
  }
}
