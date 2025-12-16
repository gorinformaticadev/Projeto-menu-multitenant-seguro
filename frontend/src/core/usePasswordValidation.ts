import { useState, useEffect } from "react";
import { useSecurityConfig } from "@/contexts/SecurityConfigContext";

export interface PasswordValidationResult {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecial: boolean;
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
  requirements: PasswordRequirement[];
}

export interface PasswordRequirement {
  key: string;
  label: string;
  valid: boolean;
  required: boolean;
}

/**
 * Hook para validação de senha baseado nas configurações de segurança do sistema
 */
export function usePasswordValidation(password: string) {
  const { config } = useSecurityConfig();
  const [validation, setValidation] = useState<PasswordValidationResult>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumbers: false,
    hasSpecial: false,
    isValid: false,
    strength: 'weak',
    score: 0,
    requirements: [],
  });

  useEffect(() => {
    if (!config?.passwordPolicy) {
      // Se não há configuração, assume valores padrão
      const defaultValidation: PasswordValidationResult = {
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumbers: /\d/.test(password),
        hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password),
        isValid: false,
        strength: 'weak',
        score: 0,
        requirements: [],
      };
      
      defaultValidation.isValid = defaultValidation.minLength && 
                                  defaultValidation.hasUppercase && 
                                  defaultValidation.hasLowercase && 
                                  defaultValidation.hasNumbers && 
                                  defaultValidation.hasSpecial;
      
      setValidation(defaultValidation);
      return;
    }

    const policy = config.passwordPolicy;
    
    // Validações individuais
    const result: PasswordValidationResult = {
      minLength: password.length >= policy.minLength,
      hasUppercase: policy.requireUppercase ? /[A-Z]/.test(password) : true,
      hasLowercase: policy.requireLowercase ? /[a-z]/.test(password) : true,
      hasNumbers: policy.requireNumbers ? /\d/.test(password) : true,
      hasSpecial: policy.requireSpecial ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) : true,
      isValid: false,
      strength: 'weak',
      score: 0,
      requirements: [],
    };

    // Calcula a pontuação da senha
    let score = 0;
    if (result.minLength) score += 20;
    if (result.hasUppercase) score += 20;
    if (result.hasLowercase) score += 20;
    if (result.hasNumbers) score += 20;
    if (result.hasSpecial) score += 20;

    // Bônus por comprimento extra
    if (password.length >= policy.minLength + 4) score += 10;
    if (password.length >= policy.minLength + 8) score += 10;

    // Bônus por diversidade de caracteres
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 5;

    result.score = Math.min(score, 100);
    
    // Determina a força da senha
    if (score >= 90) result.strength = 'very-strong';
    else if (score >= 70) result.strength = 'strong';
    else if (score >= 50) result.strength = 'medium';
    else result.strength = 'weak';

    // Determina se a senha é válida
    result.isValid = result.minLength && result.hasUppercase && result.hasLowercase && result.hasNumbers && result.hasSpecial;

    // Monta a lista de requisitos
    result.requirements = [
      {
        key: 'minLength',
        label: `Mínimo ${policy.minLength} caracteres`,
        valid: result.minLength,
        required: true,
      },
      {
        key: 'hasUppercase',
        label: 'Pelo menos uma letra maiúscula (A-Z)',
        valid: result.hasUppercase,
        required: policy.requireUppercase,
      },
      {
        key: 'hasLowercase',
        label: 'Pelo menos uma letra minúscula (a-z)',
        valid: result.hasLowercase,
        required: policy.requireLowercase,
      },
      {
        key: 'hasNumbers',
        label: 'Pelo menos um número (0-9)',
        valid: result.hasNumbers,
        required: policy.requireNumbers,
      },
      {
        key: 'hasSpecial',
        label: 'Pelo menos um caractere especial (!@#$%...)',
        valid: result.hasSpecial,
        required: policy.requireSpecial,
      },
    ].filter(req => req.required);

    setValidation(result);
  }, [password, config]);

  return validation;
}

/**
 * Função utilitária para validar senha sem usar o hook
 */
export function validatePasswordWithPolicy(password: string, policy: {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
}): PasswordValidationResult {
  const result: PasswordValidationResult = {
    minLength: password.length >= policy.minLength,
    hasUppercase: policy.requireUppercase ? /[A-Z]/.test(password) : true,
    hasLowercase: policy.requireLowercase ? /[a-z]/.test(password) : true,
    hasNumbers: policy.requireNumbers ? /\d/.test(password) : true,
    hasSpecial: policy.requireSpecial ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) : true,
    isValid: false,
    strength: 'weak',
    score: 0,
    requirements: [],
  };

  // Calcula pontuação
  let score = 0;
  if (result.minLength) score += 20;
  if (result.hasUppercase) score += 20;
  if (result.hasLowercase) score += 20;
  if (result.hasNumbers) score += 20;
  if (result.hasSpecial) score += 20;

  if (password.length >= policy.minLength + 4) score += 10;
  if (password.length >= policy.minLength + 8) score += 10;

  result.score = Math.min(score, 100);
  
  if (score >= 90) result.strength = 'very-strong';
  else if (score >= 70) result.strength = 'strong';
  else if (score >= 50) result.strength = 'medium';
  else result.strength = 'weak';

  result.isValid = result.minLength && result.hasUppercase && result.hasLowercase && result.hasNumbers && result.hasSpecial;

  result.requirements = [
    {
      key: 'minLength',
      label: `Mínimo ${policy.minLength} caracteres`,
      valid: result.minLength,
      required: true,
    },
    {
      key: 'hasUppercase',
      label: 'Pelo menos uma letra maiúscula (A-Z)',
      valid: result.hasUppercase,
      required: policy.requireUppercase,
    },
    {
      key: 'hasLowercase',
      label: 'Pelo menos uma letra minúscula (a-z)',
      valid: result.hasLowercase,
      required: policy.requireLowercase,
    },
    {
      key: 'hasNumbers',
      label: 'Pelo menos um número (0-9)',
      valid: result.hasNumbers,
      required: policy.requireNumbers,
    },
    {
      key: 'hasSpecial',
      label: 'Pelo menos um caractere especial (!@#$%...)',
      valid: result.hasSpecial,
      required: policy.requireSpecial,
    },
  ].filter(req => req.required);

  return result;
}

/**
 * Hook para validação de confirmação de senha
 */
export function usePasswordConfirmation(password: string, confirmPassword: string) {
  const [matches, setMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmPassword) {
      setMatches(false);
      setError(null);
      return;
    }

    const passwordsMatch = password === confirmPassword;
    setMatches(passwordsMatch);
    setError(passwordsMatch ? null : "As senhas não coincidem");
  }, [password, confirmPassword]);

  return { matches, error };
}