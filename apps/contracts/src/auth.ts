import { z } from "zod";
import type { ApiVersion } from "./http";

const nonEmptyTrimmedString = (message: string) => z.string().trim().min(1, message);
const optionalTrimmedString = z.string().trim().min(1).optional();

export const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "USER", "CLIENT"]);
export type AppRole = z.infer<typeof roleSchema>;

export const authPaths = {
  login: "/auth/login",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
  login2fa: "/auth/login-2fa",
  me: "/auth/me",
  twoFactorEnrollmentGenerate: "/auth/2fa/enrollment/generate",
  twoFactorEnrollmentEnable: "/auth/2fa/enrollment/enable",
  twoFactorGenerate: "/auth/2fa/generate",
  twoFactorEnable: "/auth/2fa/enable",
  twoFactorDisable: "/auth/2fa/disable",
  twoFactorStatus: "/auth/2fa/status",
  emailVerify: "/auth/email/verify",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
} as const;

export const authTenantSchema = z
  .object({
    id: nonEmptyTrimmedString("Tenant id e obrigatorio"),
    nomeFantasia: nonEmptyTrimmedString("Nome fantasia e obrigatorio"),
    cnpjCpf: nonEmptyTrimmedString("Documento e obrigatorio"),
    telefone: nonEmptyTrimmedString("Telefone e obrigatorio"),
    logoUrl: z.string().trim().min(1).optional(),
    email: z.string().trim().email("Email invalido").optional(),
  })
  .strict();

export const authUserPreferencesSchema = z
  .object({
    theme: z.string().trim().min(1).optional(),
  })
  .strict();

export const authUserSchema = z
  .object({
    id: nonEmptyTrimmedString("User id e obrigatorio"),
    email: z.string().trim().toLowerCase().email("Email invalido"),
    name: nonEmptyTrimmedString("Nome e obrigatorio"),
    role: roleSchema,
    tenantId: z.string().trim().min(1).nullable(),
    avatarUrl: z.string().trim().min(1).nullable().optional(),
    tenant: authTenantSchema.nullable().optional(),
    twoFactorEnabled: z.boolean().optional(),
    preferences: authUserPreferencesSchema.nullable().optional(),
  })
  .strict();

export type AuthUser = z.infer<typeof authUserSchema>;
export const authUserSchemaV1 = authUserSchema.omit({
  preferences: true,
});
export const authUserSchemaV2 = authUserSchema;

export const authLoginBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email invalido"),
    password: z.string().min(6, "Senha deve ter no minimo 6 caracteres"),
  })
  .strict();

export type AuthLoginBody = z.infer<typeof authLoginBodySchema>;

export const authRefreshBodySchema = z
  .object({
    refreshToken: optionalTrimmedString,
  })
  .strict();

export type AuthRefreshBody = z.infer<typeof authRefreshBodySchema>;

export const authLogoutBodySchema = z
  .object({
    refreshToken: optionalTrimmedString,
  })
  .strict();

export type AuthLogoutBody = z.infer<typeof authLogoutBodySchema>;

export const authLogin2faBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email invalido"),
    password: nonEmptyTrimmedString("Senha e obrigatoria"),
    twoFactorToken: z.string().trim().length(6, "Codigo deve ter 6 digitos"),
    trustDevice: z.boolean().optional(),
  })
  .strict();

export type AuthLogin2faBody = z.infer<typeof authLogin2faBodySchema>;

export const authCompleteTwoFactorEnrollmentBodySchema = z
  .object({
    token: z.string().trim().length(6, "Codigo deve ter 6 digitos"),
    trustDevice: z.boolean().optional(),
  })
  .strict();

export type AuthCompleteTwoFactorEnrollmentBody = z.infer<
  typeof authCompleteTwoFactorEnrollmentBodySchema
>;

export const authVerifyTwoFactorBodySchema = z
  .object({
    token: z.string().trim().length(6, "Codigo deve ter 6 digitos"),
  })
  .strict();

export type AuthVerifyTwoFactorBody = z.infer<typeof authVerifyTwoFactorBodySchema>;

export const authForgotPasswordBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email invalido"),
  })
  .strict();

export type AuthForgotPasswordBody = z.infer<typeof authForgotPasswordBodySchema>;

export const authResetPasswordBodySchema = z
  .object({
    token: nonEmptyTrimmedString("Token e obrigatorio"),
    newPassword: z
      .string()
      .min(8, "Nova senha deve ter pelo menos 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/,
        "Nova senha deve conter letra minuscula, maiuscula, numero e caractere especial",
      ),
  })
  .strict();

export type AuthResetPasswordBody = z.infer<typeof authResetPasswordBodySchema>;

export const authVerifyEmailBodySchema = z
  .object({
    token: nonEmptyTrimmedString("Token e obrigatorio"),
  })
  .strict();

export type AuthVerifyEmailBody = z.infer<typeof authVerifyEmailBodySchema>;

export const authTwoFactorSecretResponseSchema = z
  .object({
    secret: nonEmptyTrimmedString("Secret e obrigatorio"),
    qrCode: nonEmptyTrimmedString("QRCode e obrigatorio"),
  })
  .strict();

export type AuthTwoFactorSecretResponse = z.infer<typeof authTwoFactorSecretResponseSchema>;

export const authMessageResponseSchema = z
  .object({
    message: nonEmptyTrimmedString("Mensagem e obrigatoria"),
  })
  .strict();

export type AuthMessageResponse = z.infer<typeof authMessageResponseSchema>;

export const authTwoFactorStatusResponseSchema = z
  .object({
    enabled: z.boolean(),
    globallyEnabled: z.boolean(),
    required: z.boolean(),
    requiredForAdmins: z.boolean(),
    suggested: z.boolean(),
  })
  .strict();

export type AuthTwoFactorStatusResponse = z.infer<typeof authTwoFactorStatusResponseSchema>;

export const authAuthenticatedResponseSchema = z
  .object({
    status: z.literal("AUTHENTICATED"),
    authenticated: z.literal(true),
    requiresTwoFactor: z.literal(false),
    mustEnrollTwoFactor: z.literal(false),
    accessTokenExpiresAt: z.string().datetime().nullable().optional(),
    refreshTokenExpiresAt: z.string().datetime().nullable().optional(),
    user: authUserSchema,
  })
  .strict();

export type AuthAuthenticatedResponse = z.infer<typeof authAuthenticatedResponseSchema>;
export const authAuthenticatedResponseSchemaV1 = z
  .object({
    status: z.literal("AUTHENTICATED"),
    authenticated: z.literal(true),
    requiresTwoFactor: z.literal(false),
    mustEnrollTwoFactor: z.literal(false),
    accessTokenExpiresAt: z.string().datetime().nullable().optional(),
    refreshTokenExpiresAt: z.string().datetime().nullable().optional(),
    user: authUserSchemaV1,
  })
  .strict();
export const authAuthenticatedResponseSchemaV2 = authAuthenticatedResponseSchema;

export const authRequiresTwoFactorResponseSchema = z
  .object({
    status: z.literal("REQUIRES_TWO_FACTOR"),
    authenticated: z.literal(false),
    requiresTwoFactor: z.literal(true),
    mustEnrollTwoFactor: z.literal(false),
  })
  .strict();

export type AuthRequiresTwoFactorResponse = z.infer<typeof authRequiresTwoFactorResponseSchema>;

export const authMustEnrollTwoFactorResponseSchema = z
  .object({
    status: z.literal("MUST_ENROLL_TWO_FACTOR"),
    authenticated: z.literal(false),
    requiresTwoFactor: z.literal(false),
    mustEnrollTwoFactor: z.literal(true),
    enrollmentExpiresAt: z.string().datetime().optional(),
  })
  .strict();

export type AuthMustEnrollTwoFactorResponse = z.infer<
  typeof authMustEnrollTwoFactorResponseSchema
>;

export const authLoginFlowResponseSchema = z.discriminatedUnion("status", [
  authAuthenticatedResponseSchema,
  authRequiresTwoFactorResponseSchema,
  authMustEnrollTwoFactorResponseSchema,
]);

export type AuthLoginFlowResponse = z.infer<typeof authLoginFlowResponseSchema>;
export const authLoginFlowResponseSchemaV1 = z.discriminatedUnion("status", [
  authAuthenticatedResponseSchemaV1,
  authRequiresTwoFactorResponseSchema,
  authMustEnrollTwoFactorResponseSchema,
]);
export const authLoginFlowResponseSchemaV2 = authLoginFlowResponseSchema;

export const authUserSchemasByVersion = {
  "1": authUserSchemaV1,
  "2": authUserSchemaV2,
} satisfies Record<ApiVersion, z.ZodTypeAny>;

export const authAuthenticatedResponseSchemasByVersion = {
  "1": authAuthenticatedResponseSchemaV1,
  "2": authAuthenticatedResponseSchemaV2,
} satisfies Record<ApiVersion, z.ZodTypeAny>;

export const authLoginFlowResponseSchemasByVersion = {
  "1": authLoginFlowResponseSchemaV1,
  "2": authLoginFlowResponseSchemaV2,
} satisfies Record<ApiVersion, z.ZodTypeAny>;
