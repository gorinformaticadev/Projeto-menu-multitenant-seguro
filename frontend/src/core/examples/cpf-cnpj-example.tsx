"use client";

import { useState } from "react";
import { CPFCNPJInput } from "@/components/ui/cpf-cnpj-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Exemplo de uso do componente CPFCNPJInput
 * Este arquivo demonstra diferentes formas de usar o componente
 */
export function CPFCNPJExample() {
  const [document1, setDocument1] = useState("");
  const [document2, setDocument2] = useState("");
  const [document3, setDocument3] = useState("");
  const [isValid1, setIsValid1] = useState(false);
  const [isValid2, setIsValid2] = useState(false);
  const [isValid3, setIsValid3] = useState(false);
  const [customError, setCustomError] = useState("");

  const handleSubmit = () => {
    if (!isValid1 || !isValid2 || !isValid3) {
      alert("Preencha todos os documentos corretamente!");
      return;
    }
    
    alert(`Documentos válidos:\n1: ${document1}\n2: ${document2}\n3: ${document3}`);
  };

  const simulateError = () => {
    setCustomError("Erro simulado: Este documento já está cadastrado no sistema");
    setTimeout(() => setCustomError(""), 3000);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Exemplos de Uso - CPF/CNPJ Input</h1>
        <p className="text-muted-foreground">
          Demonstração do componente reutilizável de validação de CPF/CNPJ
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Exemplo 1: Uso básico */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplo 1: Uso Básico</CardTitle>
            <CardDescription>
              Componente com validação ativada e feedback visual
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CPFCNPJInput
              label="Documento (CPF ou CNPJ)"
              value={document1}
              onChange={(value, isValid) => {
                setDocument1(value);
                setIsValid1(isValid);
              }}
              showValidation={true}
              placeholder="Digite seu CPF ou CNPJ"
            />
            
            <div className="flex items-center gap-2">
              <span className="text-sm">Status:</span>
              <Badge variant={isValid1 ? "default" : "destructive"}>
                {isValid1 ? "Válido" : "Inválido"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Exemplo 2: Sem validação visual */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplo 2: Apenas Formatação</CardTitle>
            <CardDescription>
              Componente sem validação visual, apenas formatação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CPFCNPJInput
              label="Documento (Apenas Formatação)"
              value={document2}
              onChange={(value, isValid) => {
                setDocument2(value);
                setIsValid2(isValid);
              }}
              showValidation={false}
              placeholder="Formatação automática"
            />
            
            <div className="text-sm text-muted-foreground">
              Valor formatado: <code>{document2}</code>
            </div>
          </CardContent>
        </Card>

        {/* Exemplo 3: Com erro customizado */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplo 3: Erro Customizado</CardTitle>
            <CardDescription>
              Componente com erro externo (ex: validação do servidor)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CPFCNPJInput
              label="Documento com Validação Externa"
              value={document3}
              onChange={(value, isValid) => {
                setDocument3(value);
                setIsValid3(isValid);
                setCustomError(""); // Limpa erro ao digitar
              }}
              error={customError}
              showValidation={true}
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

        {/* Exemplo 4: Formulário completo */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplo 4: Formulário Completo</CardTitle>
            <CardDescription>
              Exemplo de uso em um formulário real
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium">Documento 1:</label>
                  <div className="text-xs text-muted-foreground mb-2">
                    {document1 ? `Formatado: ${document1}` : "Aguardando entrada..."}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Documento 2:</label>
                  <div className="text-xs text-muted-foreground mb-2">
                    {document2 ? `Formatado: ${document2}` : "Aguardando entrada..."}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Documento 3:</label>
                  <div className="text-xs text-muted-foreground mb-2">
                    {document3 ? `Formatado: ${document3}` : "Aguardando entrada..."}
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSubmit}
                disabled={!isValid1 || !isValid2 || !isValid3}
                className="w-full"
              >
                Enviar Formulário
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
                {`import { CPFCNPJInput } from "@/components/ui/cpf-cnpj-input";`}
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Uso Básico:</h4>
              <code className="block bg-muted p-2 rounded text-sm whitespace-pre">
{`<CPFCNPJInput
  label="CPF/CNPJ"
  value={document}
  onChange={(value, isValid) => {
    setDocument(value);
    setIsDocumentValid(isValid);
  }}
  showValidation={true}
/>`}
              </code>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Props Disponíveis:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li><code>label</code>: Texto do label (opcional)</li>
                <li><code>error</code>: Mensagem de erro externa (opcional)</li>
                <li><code>onChange</code>: Callback com valor e status de validação</li>
                <li><code>showValidation</code>: Ativar/desativar validação visual</li>
                <li>+ todas as props padrão do componente Input</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}