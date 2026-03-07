import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@core/decorators/public.decorator';
import { SystemTelemetryService } from '@common/services/system-telemetry.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly systemTelemetryService: SystemTelemetryService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, _info, context: ExecutionContext) {
    if (err || !user) {
      this.systemTelemetryService.recordSecurityEvent({
        type: 'unauthorized',
        request: context?.switchToHttp?.().getRequest?.(),
        statusCode: 401,
      });
      throw err || new UnauthorizedException('Token invalido ou expirado');
    }
    return user;
  }
}
