import {
  authCompleteTwoFactorEnrollmentBodySchema,
  type AuthCompleteTwoFactorEnrollmentBody,
} from '@contracts/auth';

export type Complete2FAEnrollmentDto = AuthCompleteTwoFactorEnrollmentBody;

export const complete2FAEnrollmentDtoSchema = authCompleteTwoFactorEnrollmentBodySchema;
