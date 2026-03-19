import { authVerifyTwoFactorBodySchema, type AuthVerifyTwoFactorBody } from '@contracts/auth';

export type Verify2FADto = AuthVerifyTwoFactorBody;

export const verify2FADtoSchema = authVerifyTwoFactorBodySchema;
