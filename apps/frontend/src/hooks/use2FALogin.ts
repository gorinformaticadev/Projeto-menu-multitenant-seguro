"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function use2FALogin() {
  const { loginWithCredentials, loginWith2FA } = useAuth();
  const [requires2FA, setRequires2FA] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function attemptLogin(email: string, password: string) {
    setCredentials({ email, password });
    setLoading(true);
    setError("");

    try {
      // Delegar para AuthContext
      const result = await loginWithCredentials(email, password);

      if (result.success) {
        // Login concluído com sucesso - AuthContext já redirecionou
        return { success: true };
      }

      if (result.requires2FA) {
        // 2FA necessário - atualizar estado da UI
        setRequires2FA(true);
        return { success: false, requires2FA: true };
      }

      // Erro de login
      setError(result.error || "Erro ao fazer login");
      return { success: false, requires2FA: false };
    } catch (err: unknown) {
      // Erro inesperado
      setError("Erro ao fazer login");
      return { success: false, requires2FA: false };
    } finally {
      setLoading(false);
    }
  }

  async function loginWith2FACode(code: string) {
    setLoading(true);
    setError("");

    try {
      // Delegar para AuthContext
      const result = await loginWith2FA(credentials.email, credentials.password, code);

      if (result.success) {
        // Login concluído com sucesso - AuthContext já redirecionou
        return { success: true };
      }

      // Erro no código 2FA
      setError(result.error || "Código inválido");
      return { success: false };
    } catch (err: unknown) {
      // Erro inesperado
      setError("Erro ao validar código");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setRequires2FA(false);
    setCredentials({ email: "", password: "" });
    setError("");
  }

  return {
    requires2FA,
    loading,
    error,
    attemptLogin,
    loginWith2FA: loginWith2FACode,
    reset,
    credentials,
  };
}
