"use client";

import { useState, useEffect } from "react";
import { useSecurityConfig } from "@/contexts/SecurityConfigContext";
import { Check, X } from "lucide-react";

interface PasswordValidatorProps {
  password: string;
  showRequirements?: boolean;
}

interface ValidationResult {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

export function PasswordValidator({ password, showRequirements = true }: PasswordValidatorProps) {
  const { config } = useSecurityConfig();
  const [validation, setValidation] = useState<ValidationResult>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumbers: false,
    hasSpecial: false,
    isValid: false,
  });

  useEffect(() => {
    if (!config?.passwordPolicy) return;

    const policy = config.passwordPolicy;
    const result: ValidationResult = {
      minLength: password.length >= policy.minLength,
      hasUppercase: policy.requireUppercase ? /[A-Z]/.test(password) : true,
      hasLowercase: policy.requireLowercase ? /[a-z]/.test(password) : true,
      hasNumbers: policy.requireNumbers ? /\d/.test(password) : true,
      hasSpecial: policy.requireSpecial ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) : true,
      isValid: false,
    };

    result.isValid = result.minLength && result.hasUppercase && result.hasLowercase && result.hasNumbers && result.hasSpecial;
    setValidation(result);
  }, [password, config]);

  if (!showRequirements || !config?.passwordPolicy) {
    return null;
  }

  const policy = config.passwordPolicy;
  const requirements = [
    {
      key: 'minLength',
      label: `${policy.minLength} caracteres mínimo`,
      valid: validation.minLength,
    },
    {
      key: 'hasUppercase',
      label: 'Pelo menos uma letra maiúscula (A-Z)',
      valid: validation.hasUppercase,
      required: policy.requireUppercase,
    },
    {
      key: 'hasLowercase',
      label: 'Pelo menos uma letra minúscula (a-z)',
      valid: validation.hasLowercase,
      required: policy.requireLowercase,
    },
    {
      key: 'hasNumbers',
      label: 'Pelo menos um número (0-9)',
      valid: validation.hasNumbers,
      required: policy.requireNumbers,
    },
    {
      key: 'hasSpecial',
      label: 'Pelo menos um caractere especial (!@#$%...)',
      valid: validation.hasSpecial,
      required: policy.requireSpecial,
    },
  ].filter(req => req.required);

  return (
    <div className="space-y-2 mt-2">
      <p className="text-sm font-medium text-muted-foreground">Requisitos da senha:</p>
      <div className="space-y-1">
        {requirements.map((req) => (
          <div key={req.key} className="flex items-center gap-2 text-sm">
            {req.valid ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <X className="h-4 w-4 text-red-500" />
            )}
            <span className={req.valid ? "text-green-700" : "text-red-600"}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
      {password && (
        <div className="text-sm">
          {validation.isValid ? (
            <span className="text-green-700 font-medium">✓ Senha válida</span>
          ) : (
            <span className="text-red-600 font-medium">✗ Senha não atende aos requisitos</span>
          )}
        </div>
      )}
    </div>
  );
}

// Função utilitária para validar senha
export function validatePassword(password: string, policy: any): ValidationResult {
  return {
    minLength: password.length >= policy.minLength,
    hasUppercase: policy.requireUppercase ? /[A-Z]/.test(password) : true,
    hasLowercase: policy.requireLowercase ? /[a-z]/.test(password) : true,
    hasNumbers: policy.requireNumbers ? /\d/.test(password) : true,
    hasSpecial: policy.requireSpecial ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) : true,
    isValid: false,
  };
}

// Hook personalizado para validação de senha
export function usePasswordValidation(password: string) {
  const { config } = useSecurityConfig();
  const [validation, setValidation] = useState<ValidationResult>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumbers: false,
    hasSpecial: false,
    isValid: false,
  });

  useEffect(() => {
    if (!config?.passwordPolicy) return;

    const result = validatePassword(password, config.passwordPolicy);
    result.isValid = result.minLength && result.hasUppercase && result.hasLowercase && result.hasNumbers && result.hasSpecial;
    setValidation(result);
  }, [password, config]);

  return validation;
}