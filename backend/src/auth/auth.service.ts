import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    @Inject(forwardRef(() => AuditService))
    private auditService: AuditService,
  ) {}

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { email, password } = loginDto;

    // Busca o usuário pelo email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      // Log de tentativa de login falha
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { email, reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verifica a senha usando bcrypt.compare()
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Log de tentativa de login falha
      await this.auditService.log({
        action: 'LOGIN_FAILED',
        userId: user.id,
        tenantId: user.tenantId,
        ipAddress,
        userAgent,
        details: { email, reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Gera o JWT com payload contendo: id, email, role, tenantId
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload);

    // Log de login bem-sucedido
    await this.auditService.log({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      userAgent,
      details: { email },
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}
