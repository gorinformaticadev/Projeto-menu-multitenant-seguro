"use client";

import { useState } from 'react';

export default function TestApiPage() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testApi = async () => {
    setLoading(true);
    try {
      console.log('Testando API...');
      const response = await fetch('/api/modules/test.js');
      console.log('Response:', response.status, response.statusText);
      
      if (response.ok) {
        const code = await response.text();
        console.log('Code received:', code);
        setResult(`✅ Sucesso! Código recebido:\n${code}`);
        
        // Testar execução
        const func = new Function('window', 'console', code);
        func(window, console);
        
        if (window.testModule) {
          const testResult = window.testModule();
          setResult(prev => prev + `\n\n✅ Execução: ${JSON.stringify(testResult)}`);
        }
      } else {
        const error = await response.text();
        setResult(`❌ Erro ${response.status}: ${error}`);
      }
    } catch (error) {
      console.error('Erro:', error);
      setResult(`❌ Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Teste da API de Módulos</h1>
      
      <button
        onClick={testApi}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testando...' : 'Testar API'}
      </button>
      
      {result && (
        <pre className="mt-4 p-4 bg-gray-100 rounded whitespace-pre-wrap text-sm">
          {result}
        </pre>
      )}
    </div>
  );
}