"use client";

export default function TestModulePage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-4">🧪 Teste de Roteamento</h1>
      <p className="text-gray-600 mb-4">Esta é uma página de teste para verificar se o roteamento está funcionando.</p>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Status do Sistema</h2>
        <div className="space-y-2">
          <div className="flex items-center">
            <span className="text-green-500 mr-2">✅</span>
            <span>Next.js funcionando</span>
          </div>
          <div className="flex items-center">
            <span className="text-green-500 mr-2">✅</span>
            <span>Tailwind CSS carregado</span>
          </div>
          <div className="flex items-center">
            <span className="text-green-500 mr-2">✅</span>
            <span>Roteamento dinâmico ativo</span>
          </div>
        </div>
        
        <div className="mt-6">
          <a 
            href="/modules/module-exemplo" 
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            🚀 Testar Módulo Exemplo
          </a>
        </div>
      </div>
    </div>
  );
}