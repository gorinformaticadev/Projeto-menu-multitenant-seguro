import { authLogin2faBodySchema, type AuthLogin2faBody } from '@contracts/auth';

export type Login2FADto = AuthLogin2faBody;

export const login2FADtoSchema = authLogin2faBodySchema;
