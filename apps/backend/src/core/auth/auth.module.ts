import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = config.get<string>('JWT_EXPIRES_IN', '7d');

        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            // Garantir que o expiresIn seja compatível com a tipagem do NestJS 11 (number | StringValue)
            expiresIn: /^\d+$/.test(expiresIn) ? Number(expiresIn) : (expiresIn as StringValue),
          },
        };
      },
    }),
    forwardRef(() => AuditModule),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TwoFactorService, EmailVerificationService, PasswordResetService, JwtStrategy],
  exports: [AuthService, TwoFactorService, EmailVerificationService, PasswordResetService],
})
export class AuthModule { }
