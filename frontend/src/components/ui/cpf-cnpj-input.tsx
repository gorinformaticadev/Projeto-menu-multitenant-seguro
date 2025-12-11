"use client";

import * as React from "react";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "@/lib/utils";
import { 
  formatCPFOrCNPJ, 
  validateDocument, 
  getDocumentType,
  cleanDocument 
} from "@/lib/cpf-cnpj-validator";

export interface CPFCNPJInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  onChange?: (value: string, isValid: boolean) => void;
  showValidation?: boolean;
}

const CPFCNPJInput = React.forwardRef<HTMLInputElement, CPFCNPJInputProps>(
  ({ className, label, error, onChange, showValidation = true, ...props }, ref) => {
    const [value, setValue] = React.useState(props.value?.toString() || "");
    const [validationError, setValidationError] = React.useState<string | null>(null);
    const [documentType, setDocumentType] = React.useState<'cpf' | 'cnpj' | 'unknown'>('unknown');

    // Atualiza o valor quando props.value muda
    React.useEffect(() => {
      if (props.value !== undefined) {
        setValue(props.value.toString());
      }
    }, [props.value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Remove caracteres não numéricos para validação
      const cleanValue = cleanDocument(inputValue);
      
      // Limita a 14 dígitos (CNPJ)
      if (cleanValue.length > 14) {
        return;
      }

      // Formata o valor
      const formattedValue = formatCPFOrCNPJ(inputValue);
      setValue(formattedValue);

      // Detecta o tipo de documento
      const type = getDocumentType(cleanValue);
      setDocumentType(type);

      // Valida apenas se showValidation estiver ativo
      let isValid = true;
      if (showValidation) {
        const errorMessage = validateDocument(formattedValue);
        setValidationError(errorMessage);
        isValid = errorMessage === null;
      }

      // Chama o callback onChange se fornecido
      if (onChange) {
        onChange(formattedValue, isValid);
      }
    };

    const handleBlur = () => {
      // Valida no blur se showValidation estiver ativo
      if (showValidation && value) {
        const errorMessage = validateDocument(value);
        setValidationError(errorMessage);
      }
    };

    const getPlaceholder = () => {
      if (props.placeholder) return props.placeholder;
      
      switch (documentType) {
        case 'cpf':
          return '000.000.000-00';
        case 'cnpj':
          return '00.000.000/0000-00';
        default:
          return 'CPF ou CNPJ';
      }
    };

    const getHelperText = () => {
      if (!value) return null;
      
      const cleanValue = cleanDocument(value);
      if (cleanValue.length === 0) return null;
      
      if (cleanValue.length <= 11) {
        return `CPF (${cleanValue.length}/11 dígitos)`;
      } else {
        return `CNPJ (${cleanValue.length}/14 dígitos)`;
      }
    };

    const displayError = error || validationError;

    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={props.id} className={cn(displayError && "text-destructive")}>
            {label}
          </Label>
        )}
        
        <div className="relative">
          <Input
            {...props}
            ref={ref}
            type="text"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={getPlaceholder()}
            className={cn(
              displayError && "border-destructive focus-visible:ring-destructive",
              className
            )}
            autoComplete="off"
          />
          
          {/* Indicador do tipo de documento */}
          {value && documentType !== 'unknown' && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <span className={cn(
                "text-xs px-2 py-1 rounded-full font-medium",
                documentType === 'cpf' 
                  ? "bg-blue-100 text-blue-700" 
                  : "bg-green-100 text-green-700"
              )}>
                {documentType.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Helper text */}
        {showValidation && value && !displayError && (
          <p className="text-sm text-muted-foreground">
            {getHelperText()}
          </p>
        )}

        {/* Error message */}
        {displayError && (
          <p className="text-sm text-destructive">
            {displayError}
          </p>
        )}
      </div>
    );
  }
);

CPFCNPJInput.displayName = "CPFCNPJInput";

export { CPFCNPJInput };