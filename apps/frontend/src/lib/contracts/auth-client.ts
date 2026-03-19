import type { AxiosRequestConfig } from "axios";
import {
  authAuthenticatedResponseSchemasByVersion,
  authCompleteTwoFactorEnrollmentBodySchema,
  authForgotPasswordBodySchema,
  authLogin2faBodySchema,
  authLoginBodySchema,
  authLoginFlowResponseSchemasByVersion,
  authLogoutBodySchema,
  authMessageResponseSchema,
  authPaths,
  authResetPasswordBodySchema,
  authTwoFactorSecretResponseSchema,
  authTwoFactorStatusResponseSchema,
  authUserSchemasByVersion,
  authVerifyTwoFactorBodySchema,
  type AuthCompleteTwoFactorEnrollmentBody,
  type AuthForgotPasswordBody,
  type AuthLogin2faBody,
  type AuthLoginBody,
  type AuthLogoutBody,
  type AuthResetPasswordBody,
  type AuthVerifyTwoFactorBody,
} from "@contracts/auth";
import { API_CURRENT_VERSION } from "@contracts/http";
import api from "@/lib/api";
import {
  parseContractValue,
  parseVersionedContractValue,
  resolveApiVersionFromHeaders,
} from "@/lib/contracts/contract-runtime";

export async function getAuthenticatedUser(config?: AxiosRequestConfig) {
  const response = await api.get(authPaths.me, config);
  const responseVersion = resolveApiVersionFromHeaders(response.headers);
  return parseVersionedContractValue(
    authUserSchemasByVersion,
    response.data,
    authPaths.me,
    "response",
    responseVersion,
    {
      expectedVersion: API_CURRENT_VERSION,
      allowVersionFallback: responseVersion == null,
    },
  );
}

export async function loginWithPassword(
  input: AuthLoginBody,
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(authLoginBodySchema, input, authPaths.login, "request");
  const response = await api.post(authPaths.login, body, config);
  const responseVersion = resolveApiVersionFromHeaders(response.headers);
  return parseVersionedContractValue(
    authLoginFlowResponseSchemasByVersion,
    response.data,
    authPaths.login,
    "response",
    responseVersion,
    {
      expectedVersion: API_CURRENT_VERSION,
      allowVersionFallback: responseVersion == null,
    },
  );
}

export async function loginWithTwoFactor(
  input: AuthLogin2faBody,
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(authLogin2faBodySchema, input, authPaths.login2fa, "request");
  const response = await api.post(authPaths.login2fa, body, config);
  const responseVersion = resolveApiVersionFromHeaders(response.headers);
  return parseVersionedContractValue(
    authAuthenticatedResponseSchemasByVersion,
    response.data,
    authPaths.login2fa,
    "response",
    responseVersion,
    {
      expectedVersion: API_CURRENT_VERSION,
      allowVersionFallback: responseVersion == null,
    },
  );
}

export async function completeTwoFactorEnrollment(
  input: AuthCompleteTwoFactorEnrollmentBody,
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(
    authCompleteTwoFactorEnrollmentBodySchema,
    input,
    authPaths.twoFactorEnrollmentEnable,
    "request",
  );
  const response = await api.post(authPaths.twoFactorEnrollmentEnable, body, config);
  const responseVersion = resolveApiVersionFromHeaders(response.headers);
  return parseVersionedContractValue(
    authAuthenticatedResponseSchemasByVersion,
    response.data,
    authPaths.twoFactorEnrollmentEnable,
    "response",
    responseVersion,
    {
      expectedVersion: API_CURRENT_VERSION,
      allowVersionFallback: responseVersion == null,
    },
  );
}

export async function logoutSession(
  input: AuthLogoutBody = {},
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(authLogoutBodySchema, input, authPaths.logout, "request");
  const response = await api.post(authPaths.logout, body, config);
  return parseContractValue(authMessageResponseSchema, response.data, authPaths.logout, "response");
}

export async function generateTwoFactorSecret(
  mode: "settings" | "enrollment",
  config?: AxiosRequestConfig,
) {
  const path =
    mode === "enrollment" ? authPaths.twoFactorEnrollmentGenerate : authPaths.twoFactorGenerate;
  const response = await api.get(path, config);
  return parseContractValue(authTwoFactorSecretResponseSchema, response.data, path, "response");
}

export async function enableTwoFactor(
  input: AuthVerifyTwoFactorBody,
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(
    authVerifyTwoFactorBodySchema,
    input,
    authPaths.twoFactorEnable,
    "request",
  );
  const response = await api.post(authPaths.twoFactorEnable, body, config);
  return parseContractValue(
    authMessageResponseSchema,
    response.data,
    authPaths.twoFactorEnable,
    "response",
  );
}

export async function disableTwoFactor(
  input: AuthVerifyTwoFactorBody,
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(
    authVerifyTwoFactorBodySchema,
    input,
    authPaths.twoFactorDisable,
    "request",
  );
  const response = await api.post(authPaths.twoFactorDisable, body, config);
  return parseContractValue(
    authMessageResponseSchema,
    response.data,
    authPaths.twoFactorDisable,
    "response",
  );
}

export async function getTwoFactorStatus(config?: AxiosRequestConfig) {
  const response = await api.get(authPaths.twoFactorStatus, config);
  return parseContractValue(
    authTwoFactorStatusResponseSchema,
    response.data,
    authPaths.twoFactorStatus,
    "response",
  );
}

export async function requestPasswordReset(
  input: AuthForgotPasswordBody,
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(
    authForgotPasswordBodySchema,
    input,
    authPaths.forgotPassword,
    "request",
  );
  const response = await api.post(authPaths.forgotPassword, body, config);
  return parseContractValue(
    authMessageResponseSchema,
    response.data,
    authPaths.forgotPassword,
    "response",
  );
}

export async function resetPassword(
  input: AuthResetPasswordBody,
  config?: AxiosRequestConfig,
) {
  const body = parseContractValue(
    authResetPasswordBodySchema,
    input,
    authPaths.resetPassword,
    "request",
  );
  const response = await api.post(authPaths.resetPassword, body, config);
  return parseContractValue(
    authMessageResponseSchema,
    response.data,
    authPaths.resetPassword,
    "response",
  );
}
