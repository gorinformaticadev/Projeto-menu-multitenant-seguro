import { authResetPasswordBodySchema, type AuthResetPasswordBody } from '@contracts/auth';

export type ResetPasswordDto = AuthResetPasswordBody;

export const resetPasswordDtoSchema = authResetPasswordBodySchema;
