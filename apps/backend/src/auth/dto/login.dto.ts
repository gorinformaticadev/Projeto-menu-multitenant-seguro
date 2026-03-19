import { authLoginBodySchema, type AuthLoginBody } from '@contracts/auth';

export type LoginDto = AuthLoginBody;

export const loginDtoSchema = authLoginBodySchema;
