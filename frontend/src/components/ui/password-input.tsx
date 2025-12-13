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
        hasSpecial: policy.requireSpecial ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(value) : true,
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
    }, [value, config]); // Remove onChange da dependência para evitar loops

    // Usa ref para onChange para evitar dependências
    const onChangeRef = React.useRef(onChange);
    onChangeRef.current = onChange;

    // Chama onChange quando validation muda
    React.useEffect(() => {
      if (onChangeRef.current) {
        onChangeRef.current(value, validation.isValid);
      }
    }, [value, validation.isValid]);

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    }, []);

    // Usa ref para onConfirmChange para evitar dependências
    const onConfirmChangeRef = React.useRef(onConfirmChange);
    onConfirmChangeRef.current = onConfirmChange;

    const handleConfirmChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newConfirmValue = e.target.value;
      setConfirmValue(newConfirmValue);
      
      if (onConfirmChangeRef.current) {
        onConfirmChangeRef.current(newConfirmValue, newConfirmValue === value);
      }
    }, [value]);

    const getStrengthColor = () => {
      switch (validation.strength) {
        case 'very-strong': return 'bg-green-500';
        case 'strong': return 'bg-blue-500';
        case 'medium': return 'bg-yellow-500';
        default: return 'bg-red-500';
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
            <Label htmlFor={props.id} className={cn(error && "text-destructive")}>
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
                error && "border-destructive focus-visible:ring-destructive",
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
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Medidor de força da senha */}
        {showStrengthMeter && value && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Força da senha:</span>
              <span className={cn(
                "font-medium",
                validation.strength === 'very-strong' && "text-green-600",
                validation.strength === 'strong' && "text-blue-600",
                validation.strength === 'medium' && "text-yellow-600",
                validation.strength === 'weak' && "text-red-600"
              )}>
                {getStrengthText()}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
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
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Requisitos de segurança:
              </span>
            </div>
            
            <div className="grid gap-1">
              {requirements.map((req) => (
                <div key={req.key} className="flex items-center gap-2 text-sm">
                  {req.valid ? (
                    <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                  ) : (
                    <X className="h-3 w-3 text-red-500 flex-shrink-0" />
                  )}
                  <span className={cn(
                    req.valid ? "text-green-700" : "text-red-600"
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
                  confirmValue && !passwordsMatch && "border-destructive focus-visible:ring-destructive",
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
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>

            {/* Indicador de confirmação */}
            {confirmValue && (
              <div className="flex items-center gap-2 text-sm">
                {passwordsMatch ? (
                  <>
                    <Check className="h-3 w-3 text-green-600" />
                    <span className="text-green-700">Senhas coincidem</span>
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 text-red-500" />
                    <span className="text-red-600">Senhas não coincidem</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mensagem de erro */}
        {error && (
          <p className="text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Status geral */}
        {value && showValidation && (
          <div className="text-sm">
            {validation.isValid ? (
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-4 w-4" />
                <span className="font-medium">Senha atende a todos os requisitos</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
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