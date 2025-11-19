"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

export function use2FALogin() {
  const router = useRouter();
  const [requires2FA, setRequires2FA] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function attemptLogin(email: string, password: string) {
    setCredentials({ email, password });
    setLoading(true);
    setError("");

    try {
      // Tentar login normal primeiro
      const response = await api.post("/auth/login", { email, password });
      
      // Se chegou aqui, login normal funcionou (sem 2FA)
      const { accessToken, refreshToken, user } = response.data;
      
      // Salvar tokens
      if (typeof window !== "undefined") {
        sessionStorage.setItem("@App:token", accessToken);
        sessionStorage.setItem("@App:refreshToken", refreshToken);
      }
      
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
      
      // Usar setTimeout para garantir que o estado seja atualizado antes do redirect
      setTimeout(() => {
        router.push("/dashboard");
        // Fallback caso router.push não funcione
        setTimeout(() => {
          if (typeof window !== "undefined" && window.location.pathname === "/login") {
            window.location.href = "/dashboard";
          }
        }, 500);
      }, 100);
      
      return { success: true };
    } catch (err: any) {
      // Se o erro for que precisa de 2FA
      if (err.response?.data?.message?.includes("2FA")) {
        setRequires2FA(true);
        return { success: false, requires2FA: true };
      }
      
      // Outro erro
      setError(err.response?.data?.message || "Erro ao fazer login");
      return { success: false, requires2FA: false };
    } finally {
      setLoading(false);
    }
  }

  async function loginWith2FA(code: string) {
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login-2fa", {
        email: credentials.email,
        password: credentials.password,
        twoFactorToken: code,
      });

      const { accessToken, refreshToken, user } = response.data;

      // Salvar tokens
      if (typeof window !== "undefined") {
        sessionStorage.setItem("@App:token", accessToken);
        sessionStorage.setItem("@App:refreshToken", refreshToken);
      }

      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

      // Usar setTimeout para garantir que o estado seja atualizado antes do redirect
      setTimeout(() => {
        router.push("/dashboard");
        // Fallback caso router.push não funcione
        setTimeout(() => {
          if (typeof window !== "undefined" && window.location.pathname === "/login") {
            window.location.href = "/dashboard";
          }
        }, 500);
      }, 100);
      
      return { success: true };
    } catch (err: any) {
      setError(err.response?.data?.message || "Código inválido");
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
    loginWith2FA,
    reset,
    credentials,
  };
}
