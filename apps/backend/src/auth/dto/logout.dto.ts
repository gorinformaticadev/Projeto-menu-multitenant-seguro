import { authLogoutBodySchema, type AuthLogoutBody } from '@contracts/auth';

export type LogoutDto = AuthLogoutBody;

export const logoutDtoSchema = authLogoutBodySchema;
