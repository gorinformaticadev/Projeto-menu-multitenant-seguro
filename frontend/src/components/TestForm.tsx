"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TestForm() {
  const [formData, setFormData] = useState({
    email: "",
    nome: "",
    telefone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("📝 Formulário enviado:", formData);
    
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      alert("Formulário enviado com sucesso!");
    }, 2000);
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>🧪 Teste de Formulário</CardTitle>
        <CardDescription>
          Formulário simples para testar inputs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="test-email" className="block text-sm font-medium mb-1">
              Email:
            </label>
            <input
              id="test-email"
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.email}
              onChange={(e) => {
                console.log("📧 Email alterado:", e.target.value);
                setFormData({ ...formData, email: e.target.value });
              }}
              disabled={submitting}
              placeholder="Digite seu email"
            />
          </div>

          <div>
            <label htmlFor="test-nome" className="block text-sm font-medium mb-1">
              Nome:
            </label>
            <input
              id="test-nome"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.nome}
              onChange={(e) => {
                console.log("👤 Nome alterado:", e.target.value);
                setFormData({ ...formData, nome: e.target.value });
              }}
              disabled={submitting}
              placeholder="Digite seu nome"
            />
          </div>

          <div>
            <label htmlFor="test-telefone" className="block text-sm font-medium mb-1">
              Telefone:
            </label>
            <input
              id="test-telefone"
              type="tel"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.telefone}
              onChange={(e) => {
                console.log("📞 Telefone alterado:", e.target.value);
                setFormData({ ...formData, telefone: e.target.value });
              }}
              disabled={submitting}
              placeholder="Digite seu telefone"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({ email: "", nome: "", telefone: "" });
                console.log("🧹 Formulário limpo");
              }}
              disabled={submitting}
            >
              Limpar
            </Button>
          </div>

          <div className="text-sm text-gray-600">
            <p><strong>Status:</strong> {submitting ? "Enviando..." : "Pronto"}</p>
            <p><strong>Email:</strong> {formData.email || "(vazio)"}</p>
            <p><strong>Nome:</strong> {formData.nome || "(vazio)"}</p>
            <p><strong>Telefone:</strong> {formData.telefone || "(vazio)"}</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}