"use client";

import * as React from "react";
import { Input } from "./input";
import { Label } from "./label";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useSecurityConfig } from "@/contexts/SecurityConfigContext";
import { Eye, EyeOff, Check, X, Shield } from "lucide-react";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  label?: string;
  error?: string;
  onChange?: (value: string, isValid: boolean) => void;
  showValidation?: boolean;
  showStrengthMeter?: boolean;
  confirmPassword?: string;
  showConfirmation?: boolean;
  onConfirmChange?: (value: string, matches: boolean) => void;
}

interface ValidationResult {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecial: boolean;
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ 
    className, 
    label, 
    error, 
    onChange, 
    showValidation = true, 
    showStrengthMeter = true,
    confirmPassword,
    showConfirmation = false,
    onConfirmChange,
    ...props 
  }, ref) => {
    const [value, setValue] = React.useState(props.value?.toString() || "");
    const [confirmValue, setConfirmValue] = React.useState(confirmPassword || "");
    const [showPassword, setShowPassword] = React.useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
    const [validation, setValidation] = React.useState<ValidationResult>({
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumbers: false,
      hasSpecial: false,
      isValid: false,
      strength: 'weak',
      score: 0,
    });

    const { config } = useSecurityConfig();

    // Atualiza o valor quando props.value muda
    React.useEffect(() => {
      if (props.value !== undefined) {
        setValue(props.value.toString());
      }
    }, [props.value]);

    // Atualiza confirmPassword quando a prop muda
    React.useEffect(() => {
      if (confirmPassword !== undefined) {
        setConfirmValue(confirmPassword);
      }
    }, [confirmPassword]);

    // Valida a senha sempre que o valor ou configuração mudam
    React.useEffect(() => {
      if (!config?.passwordPolicy) return;

      const policy = config.passwordPolicy;
      const result: ValidationResult = {
        minLength: value.length >= policy.minLength,
        hasUppercase: policy.requireUppercase ? /[A-Z]/.test(value) : true,
        hasLowercase: policy.requireLowercase ? /[a-z]/.test(value) : true,
        hasNumbers: policy.requireNumbers ? /\d/.test(value) : true,
        hasSpecial: policy.requireSpecial ? /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(value) : true,
        isValid: false,
        strength: 'weak',
        score: 0,
      };

      // Calcula a força da senha
      let score = 0;
      if (result.minLength) score += 20;
      if (result.hasUppercase) score += 20;
      if (result.hasLowercase) score += 20;
      if (result.hasNumbers) score += 20;
      if (result.hasSpecial) score += 20;

      // Bônus por comprimento extra
      if (value.length >= policy.minLength + 4) score += 10;
      if (value.length >= policy.minLength + 8) score += 10;

      result.score = Math.min(score, 100);
      
      if (score >= 90) result.strength = 'very-strong';
      else if (score >= 70) result.strength = 'strong';
      else if (score >= 50) result.strength = 'medium';
      else result.strength = 'weak';

      result.isValid = result.minLength && result.hasUppercase && result.hasLowercase && result.hasNumbers && result.hasSpecial;
      setValidation(result);

      // Chama o callback onChange se fornecido
      if (onChange) {
        onChange(value, result.isValid);
      }
    }, [value, config, onChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    };

    const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newConfirmValue = e.target.value;
      setConfirmValue(newConfirmValue);
      
      if (onConfirmChange) {
        onConfirmChange(newConfirmValue, newConfirmValue === value);
      }
    };

    const getStrengthColor = () => {
      switch (validation.strength) {
        case 'very-strong': return 'bg-skin-success';
        case 'strong': return 'bg-skin-info';
        case 'medium': return 'bg-skin-warning';
        default: return 'bg-skin-danger';
      }
    };

    const getStrengthTextColor = () => {
      switch (validation.strength) {
        case 'very-strong': return 'text-skin-success';
        case 'strong': return 'text-skin-info';
        case 'medium': return 'text-skin-warning';
        default: return 'text-skin-danger';
      }
    };

    const getStrengthText = () => {
      switch (validation.strength) {
        case 'very-strong': return 'Muito forte';
        case 'strong': return 'Forte';
        case 'medium': return 'Média';
        default: return 'Fraca';
      }
    };

    const requirements = React.useMemo(() => {
      if (!config?.passwordPolicy) return [];

      const policy = config.passwordPolicy;
      return [
        {
          key: 'minLength',
          label: `Mínimo ${policy.minLength} caracteres`,
          valid: validation.minLength,
          required: true,
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
    }, [config, validation]);

    const passwordsMatch = confirmValue === value && confirmValue.length > 0;

    return (
      <div className="space-y-3">
        {/* Campo de senha principal */}
        <div className="space-y-2">
          {label && (
            <Label htmlFor={props.id} className={cn(error && "text-skin-danger")}>
              {label}
            </Label>
          )}
          
          <div className="relative">
            <Input
              {...props}
              ref={ref}
              type={showPassword ? "text" : "password"}
              value={value}
              onChange={handleChange}
              className={cn(
                error && "border-skin-danger focus-visible:ring-skin-danger",
                "pr-10",
                className
              )}
              autoComplete="new-password"
            />
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-skin-text-muted" />
              ) : (
                <Eye className="h-4 w-4 text-skin-text-muted" />
              )}
            </Button>
          </div>
        </div>

        {/* Medidor de força da senha */}
        {showStrengthMeter && value && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-skin-text-muted">Força da senha:</span>
              <span className={cn(
                "font-medium",
                getStrengthTextColor()
              )}>
                {getStrengthText()}
              </span>
            </div>
            
            <div className="h-2 w-full rounded-full bg-skin-background-elevated">
              <div
                className={cn("h-2 rounded-full transition-all duration-300", getStrengthColor())}
                style={{ width: `${validation.score}%` }}
              />
            </div>
          </div>
        )}

        {/* Requisitos da senha */}
        {showValidation && value && requirements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-skin-text-muted" />
              <span className="text-sm font-medium text-skin-text-muted">
                Requisitos de segurança:
              </span>
            </div>
            
            <div className="grid gap-1">
              {requirements.map((req) => (
                <div key={req.key} className="flex items-center gap-2 text-sm">
                  {req.valid ? (
                    <Check className="h-3 w-3 flex-shrink-0 text-skin-success" />
                  ) : (
                    <X className="h-3 w-3 flex-shrink-0 text-skin-danger" />
                  )}
                  <span className={cn(
                    req.valid ? "text-skin-success" : "text-skin-danger"
                  )}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campo de confirmação de senha */}
        {showConfirmation && (
          <div className="space-y-2">
            <Label htmlFor={`${props.id}-confirm`}>
              Confirmar senha
            </Label>
            
            <div className="relative">
              <Input
                id={`${props.id}-confirm`}
                type={showConfirmPassword ? "text" : "password"}
                value={confirmValue}
                onChange={handleConfirmChange}
                placeholder="Digite a senha novamente"
                className={cn(
                  confirmValue && !passwordsMatch && "border-skin-danger focus-visible:ring-skin-danger",
                  "pr-10"
                )}
                autoComplete="new-password"
              />
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-skin-text-muted" />
                ) : (
                  <Eye className="h-4 w-4 text-skin-text-muted" />
                )}
              </Button>
            </div>

            {/* Indicador de confirmação */}
            {confirmValue && (
              <div className="flex items-center gap-2 text-sm">
                {passwordsMatch ? (
                  <>
                    <Check className="h-3 w-3 text-skin-success" />
                    <span className="text-skin-success">Senhas coincidem</span>
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 text-skin-danger" />
                    <span className="text-skin-danger">Senhas não coincidem</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mensagem de erro */}
        {error && (
          <p className="text-sm text-skin-danger">
            {error}
          </p>
        )}

        {/* Status geral */}
        {value && showValidation && (
          <div className="text-sm">
            {validation.isValid ? (
              <div className="flex items-center gap-2 text-skin-success">
                <Check className="h-4 w-4" />
                <span className="font-medium">Senha atende a todos os requisitos</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-skin-danger">
                <X className="h-4 w-4" />
                <span className="font-medium">Senha não atende aos requisitos de segurança</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
