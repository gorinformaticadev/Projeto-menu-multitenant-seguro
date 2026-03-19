import { authForgotPasswordBodySchema, type AuthForgotPasswordBody } from '@contracts/auth';

export type ForgotPasswordDto = AuthForgotPasswordBody;

export const forgotPasswordDtoSchema = authForgotPasswordBodySchema;
