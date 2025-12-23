import React from 'react';

export const SistemaDashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Dashboard - Módulo Sistema
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
          <div className="p-2">
            <h2 className="text-xl font-semibold mb-2">
              Widget do Sistema
            </h2>
            <p className="text-gray-700">
              Informações do módulo funcionando perfeitamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SistemaDashboard;