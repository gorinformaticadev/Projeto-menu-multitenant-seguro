"use client";

import Link from "next/link";

export default function TestModulePage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Teste de roteamento</h1>
      <p className="mb-4 text-skin-text-muted">
        Esta pagina verifica se o roteamento principal continua funcionando.
      </p>

      <div className="rounded-lg border border-skin-border bg-skin-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Status do sistema</h2>
        <div className="space-y-2">
          <div className="flex items-center">
            <span className="mr-2 text-skin-success">OK</span>
            <span>Next.js funcionando</span>
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-skin-success">OK</span>
            <span>Tailwind CSS carregado</span>
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-skin-success">OK</span>
            <span>Roteamento dinamico ativo</span>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/modules/module-exemplo"
            className="inline-block rounded-md bg-skin-primary px-4 py-2 text-skin-text-inverse transition-colors hover:bg-skin-primary-hover"
          >
            Testar modulo exemplo
          </Link>
        </div>
      </div>
    </div>
  );
}
