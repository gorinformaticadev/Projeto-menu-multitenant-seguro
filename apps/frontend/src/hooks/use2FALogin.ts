"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type LoginStage = "credentials" | "twoFactor" | "enrollment";

export function use2FALogin() {
  const { loginWithCredentials, loginWith2FA, completeTwoFactorEnrollment } = useAuth();
  const [stage, setStage] = useState<LoginStage>("credentials");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function attemptLogin(email: string, password: string) {
    setCredentials({ email, password });
    setLoading(true);
    setError("");

    try {
      const result = await loginWithCredentials(email, password);

      if (result.success) {
        return { success: true };
      }

      if (result.requires2FA) {
        setStage("twoFactor");
        return { success: false, requires2FA: true, mustEnrollTwoFactor: false };
      }

      if (result.mustEnrollTwoFactor) {
        setStage("enrollment");
        return { success: false, requires2FA: false, mustEnrollTwoFactor: true };
      }

      setError(result.error || "Erro ao fazer login");
      return { success: false, requires2FA: false, mustEnrollTwoFactor: false };
    } catch {
      setError("Erro ao fazer login");
      return { success: false, requires2FA: false, mustEnrollTwoFactor: false };
    } finally {
      setLoading(false);
    }
  }

  async function loginWith2FACode(code: string, trustDevice: boolean) {
    setLoading(true);
    setError("");

    try {
      const result = await loginWith2FA(credentials.email, credentials.password, code, trustDevice);

      if (result.success) {
        return { success: true };
      }

      setError(result.error || "Codigo invalido");
      return { success: false };
    } catch {
      setError("Erro ao validar codigo");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }

  async function completeEnrollment(code: string, trustDevice: boolean) {
    setLoading(true);
    setError("");

    try {
      const result = await completeTwoFactorEnrollment(code, trustDevice);

      if (result.success) {
        return { success: true };
      }

      setError(result.error || "Nao foi possivel concluir o cadastro do 2FA");
      return { success: false };
    } catch {
      setError("Erro ao concluir cadastro do 2FA");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStage("credentials");
    setCredentials({ email: "", password: "" });
    setError("");
  }

  return {
    requires2FA: stage === "twoFactor",
    mustEnrollTwoFactor: stage === "enrollment",
    loading,
    error,
    attemptLogin,
    loginWith2FA: loginWith2FACode,
    completeEnrollment,
    reset,
    credentials,
  };
}
