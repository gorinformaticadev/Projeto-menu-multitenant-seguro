"use client";

import { useState } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePasswordValidation, usePasswordConfirmation } from "@/hooks/usePasswordValidation";

/**
 * Exemplo de uso do componente PasswordInput
 * Este arquivo demonstra diferentes formas de usar o componente
 */
export function PasswordInputExample() {
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [password3, setPassword3] = useState("");
  const [confirmPassword3, setConfirmPassword3] = useState("");
  const [isValid1, setIsValid1] = useState(false);
  const [isValid2, setIsValid2] = useState(false);
  const [isValid3, setIsValid3] = useState(false);
  const [customError, setCustomError] = useState("");

  // Usando o hook de validação diretamente
  const validation = usePasswordValidation(password2);
  const confirmation = usePasswordConfirmation(password3, confirmPassword3);

  const handleSubmit = () => {
    if (!isValid1 || !isValid2 || !isValid3 || !confirmation.matches) {
      alert("Preencha todas as senhas corretamente!");
      return;
    }
    
    alert("Todas as senhas são válidas!");
  };

  const simulateError = () => {
    setCustomError("Erro simulado: Esta senha já foi usada recentemente");
    setTimeout(() => setCustomError(""), 3000);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Exemplos de Uso - Password Input</h1>
        <p className="text-muted-foreground">
          Demonstração do componente reutilizável de validação de senhas
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Exemplo 1: Uso básico */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplo 1: Uso Básico</CardTitle>
            <CardDescription>
              Componente com validação completa e medidor de força
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordInput
              id="password1"
              label="Nova Senha"
              value={password1}
              onChange={(value, isValid) => {
                setPassword1(value);
                setIsValid1(isValid);
              }}
              showValidation={true}
              showStrengthMeter={true}
              placeholder="Digite sua nova senha"
            />
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Status:</span>
              <Badge variant={isValid1 ? "default" : "destructive"}>
                {isValid1 ? "Válida" : "Inválida"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Exemplo 2: Usando hook diretamente */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplo 2: Hook de Validação</CardTitle>
            <CardDescription>
              Usando o hook usePasswordValidation diretamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordInput
              id="password2"
              label="Senha com Hook"
              value={password2}
              onChange={(value, isValid) => {
                setPassword2(value);
                setIsValid2(isValid);
              }}
              showValidation={false}
              showStrengthMeter={false}
            />
            
            {/* Validação customizada usando o hook */}
            {password2 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Força:</span>
                  <Badge variant={
                    validation.strength === 'very-strong' ? 'default' :
                    validation.strength === 'strong' ? 'secondary' :
                    validation.strength === 'medium' ? 'outline' : 'destructive'
                  }>
                    {validation.strength === 'very-strong' ? 'Muito Forte' :
                     validation.strength === 'strong' ? 'Forte' :
                     validation.strength === 'medium' ? 'Média' : 'Fraca'}
                  </Badge>
                </div>
                
                <div className="text-sm">
                  <p>Pontuação: {validation.score}/100</p>
                  <p>Requisitos atendidos: {validation.requirements.filter(r => r.valid).length}/{validation.requirements.length}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exemplo 3: Com confirmação */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplo 3: Com Confirmação</CardTitle>
            <CardDescription>
              Senha com campo de confirmação integrado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordInput
              id="password3"
              label="Nova Senha"
              value={password3}
              onChange={(value, isValid) => {
                setPassword3(value);
                setIsValid3(isValid);
              }}
              showValidation={true}
              showStrengthMeter={true}
              showConfirmation={true}
              confirmPassword={confirmPassword3}
              onConfirmChange={(value, matches) => {
                setConfirmPassword3(value);
              }}
            />
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Confirmação:</span>
              <Badge variant={confirmation.matches ? "default" : "destructive"}>
                {confirmation.matches ? "Coincidem" : "Não coincidem"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Exemplo 4: Com erro customizado */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplo 4: Erro Customizado</CardTitle>
            <CardDescription>
              Componente com erro externo (ex: validação do servidor)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordInput
              id="password4"
              label="Senha com Validação Externa"
              value={password1}
              onChange={(value, isValid) => {
                setPassword1(value);
                setIsValid1(isValid);
                setCustomError(""); // Limpa erro ao digitar
              }}
              error={customError}
              showValidation={true}
              showStrengthMeter={true}
            />
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={simulateError}
            >
              Simular Erro do Servidor
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Formulário completo */}
      <Card>
        <CardHeader>
          <CardTitle>Formulário Completo</CardTitle>
          <CardDescription>
            Exemplo de uso em um formulário real de alteração de senha
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 max-w-md">
            <div>
              <h4 className="font-medium mb-2">Resumo das Senhas:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Senha 1:</span>
                  <Badge variant={isValid1 ? "default" : "secondary"} size="sm">
                    {isValid1 ? "✓ Válida" : "✗ Inválida"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Senha 2:</span>
                  <Badge variant={isValid2 ? "default" : "secondary"} size="sm">
                    {isValid2 ? "✓ Válida" : "✗ Inválida"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Senha 3:</span>
                  <Badge variant={isValid3 && confirmation.matches ? "default" : "secondary"} size="sm">
                    {isValid3 && confirmation.matches ? "✓ Válida" : "✗ Inválida"}
                  </Badge>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSubmit}
              disabled={!isValid1 || !isValid2 || !isValid3 || !confirmation.matches}
              className="w-full"
            >
              Salvar Senhas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seção de documentação */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
          <CardDescription>
            Exemplos de código para implementar o componente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Importação:</h4>
              <code className="block bg-muted p-2 rounded text-sm">
                {`import { PasswordInput } from "@/components/ui/password-input";`}
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Uso Básico:</h4>
              <code className="block bg-muted p-2 rounded text-sm whitespace-pre">
{`<PasswordInput
  label="Nova Senha"
  value={password}
  onChange={(value, isValid) => {
    setPassword(value);
    setIsPasswordValid(isValid);
  }}
  showValidation={true}
  showStrengthMeter={true}
/>`}
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Com Confirmação:</h4>
              <code className="block bg-muted p-2 rounded text-sm whitespace-pre">
{`<PasswordInput
  label="Nova Senha"
  value={password}
  onChange={(value, isValid) => setPassword(value)}
  showConfirmation={true}
  confirmPassword={confirmPassword}
  onConfirmChange={(value, matches) => setConfirmPassword(value)}
/>`}
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Props Disponíveis:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li><code>label</code>: Texto do label (opcional)</li>
                <li><code>error</code>: Mensagem de erro externa (opcional)</li>
                <li><code>onChange</code>: Callback com valor e status de validação</li>
                <li><code>showValidation</code>: Mostrar requisitos de segurança</li>
                <li><code>showStrengthMeter</code>: Mostrar medidor de força</li>
                <li><code>showConfirmation</code>: Mostrar campo de confirmação</li>
                <li><code>confirmPassword</code>: Valor da confirmação</li>
                <li><code>onConfirmChange</code>: Callback da confirmação</li>
                <li>+ todas as props padrão do componente Input</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}