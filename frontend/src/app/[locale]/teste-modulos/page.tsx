'use client';

import { useModuleMenus } from '@/hooks/useModuleMenus';
import { useEffect } from 'react';

export default function TesteModulosPage() {
  const { menus, loading, error, refreshMenus } = useModuleMenus();

  useEffect(() => {
    console.log('Menus carregados:', menus);
    console.log('Loading:', loading);
    console.log('Error:', error);
  }, [menus, loading, error]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Teste de Módulos</h1>
      
      {loading && <p>Carregando menus...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>Erro ao carregar menus: {error}</p>
        </div>
      )}
      
      <div className="mb-4">
        <button 
          onClick={refreshMenus}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Recarregar Menus
        </button>
      </div>
      
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Menus Carregados:</h2>
        {menus.length === 0 ? (
          <p>Nenhum menu encontrado</p>
        ) : (
          <ul className="list-disc pl-5">
            {menus.map((menu, index) => (
              <li key={index} className="mb-2">
                <strong>{menu.name}</strong> - {menu.path} (Permissão: {menu.permission})
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="mt-6 bg-yellow-50 p-4 rounded">
        <h3 className="text-lg font-semibold mb-2">Instruções:</h3>
        <p>Verifique o console do navegador para ver os logs detalhados.</p>
        <p>Se o módulo "ajuda" não aparecer na lista acima, pode haver um problema com:</p>
        <ul className="list-disc pl-5 mt-2">
          <li>O endpoint /tenants/my-tenant/modules/active</li>
          <li>O carregamento da configuração do módulo</li>
          <li>A estrutura do menu no arquivo de configuração</li>
        </ul>
      </div>
    </div>
  );
}