"use client";

import { useState } from "react";

declare global {
  interface Window {
    testModule?: () => unknown;
  }
}

export default function TestApiPage() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const testApi = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/modules/test.js");

      if (response.ok) {
        const code = await response.text();
        setResult(`Sucesso. Codigo recebido:\n${code}`);

        const func = new Function("window", "console", code);
        func(window, console);

        if (window.testModule) {
          const testResult = window.testModule();
          setResult((prev) => `${prev}\n\nExecucao: ${JSON.stringify(testResult)}`);
        }
      } else {
        const error = await response.text();
        setResult(`Erro ${response.status}: ${error}`);
      }
    } catch (error) {
      setResult(`Erro: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Teste da API de Modulos</h1>

      <button
        onClick={testApi}
        disabled={loading}
        className="rounded bg-skin-primary px-4 py-2 text-skin-text-inverse hover:bg-skin-primary-hover disabled:opacity-50"
      >
        {loading ? "Testando..." : "Testar API"}
      </button>

      {result && (
        <pre className="mt-4 whitespace-pre-wrap rounded bg-skin-background-elevated p-4 text-sm text-skin-text">
          {result}
        </pre>
      )}
    </div>
  );
}
