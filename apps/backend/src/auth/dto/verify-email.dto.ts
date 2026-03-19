import { authVerifyEmailBodySchema, type AuthVerifyEmailBody } from '@contracts/auth';

export type VerifyEmailDto = AuthVerifyEmailBody;

export const verifyEmailDtoSchema = authVerifyEmailBodySchema;
