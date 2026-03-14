export type PasswordPolicySnapshot = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
};

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicySnapshot,
): string[] {
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`A senha deve ter no minimo ${policy.minLength} caracteres.`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra maiuscula.');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('A senha deve conter pelo menos uma letra minuscula.');
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('A senha deve conter pelo menos um numero.');
  }

  if (policy.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('A senha deve conter pelo menos um caractere especial.');
  }

  return errors;
}
