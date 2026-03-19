import { authRefreshBodySchema, type AuthRefreshBody } from '@contracts/auth';

export type RefreshTokenDto = AuthRefreshBody;

export const refreshTokenDtoSchema = authRefreshBodySchema;
