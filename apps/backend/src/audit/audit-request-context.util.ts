import { AuditActor, AuditRequestContext } from './audit.service';
import { extractRequestContext } from '../common/interceptors/request-context.interceptor';

export interface ExtractedAuditContext {
  actor: AuditActor;
  requestCtx: AuditRequestContext;
  tenantId: string | null;
}

export const extractAuditContext = (request: any): ExtractedAuditContext => {
  const requestContext = extractRequestContext(request);
  const user = request?.user || {};

  const userId =
    typeof user?.sub === 'string' && user.sub.trim().length > 0
      ? user.sub.trim()
      : typeof user?.id === 'string' && user.id.trim().length > 0
        ? user.id.trim()
        : undefined;

  const email = typeof user?.email === 'string' && user.email.trim().length > 0 ? user.email.trim() : undefined;
  const role = typeof user?.role === 'string' && user.role.trim().length > 0 ? user.role.trim() : undefined;
  const tenantId =
    typeof user?.tenantId === 'string' && user.tenantId.trim().length > 0 ? user.tenantId.trim() : null;

  return {
    actor: {
      userId,
      email,
      role,
    },
    requestCtx: {
      ip: requestContext.ip || undefined,
      userAgent: requestContext.userAgent || undefined,
    },
    tenantId,
  };
};
