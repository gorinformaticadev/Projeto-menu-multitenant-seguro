/**
 * API ROUTE PARA SERVIR ARQUIVOS DOS MÓDULOS
 * 
 * Serve arquivos JavaScript, JSON e outros recursos dos módulos
 * de forma segura e controlada
 * 
 * Exemplos de rotas:
 * - /api/modules/boas-vindas/frontend/pages/tutorial.js
 * - /api/modules/ModuleCore.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, resolve, extname } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  const params = await props.params;
  try {
    const path = params.path;
    console.log('📂 API Modules - Requisição para:', path);

    // Determinar caminho base dos módulos
    const cwd = process.cwd();
    const modulesBasePath = cwd.endsWith('frontend')
      ? resolve(cwd, '..', 'modules')
      : resolve(cwd, 'modules');

    // Construir caminho do arquivo
    let filePath: string;

    // Caso especial: ModuleCore.js está na raiz de modules/
    if (path.length === 1 && path[0] === 'ModuleCore.js') {
      filePath = join(modulesBasePath, 'ModuleCore.js');
    } else {
      // Caminho normal: modules/[module-name]/[...rest]
      filePath = join(modulesBasePath, ...path);
    }

    console.log('📄 Tentando carregar arquivo:', filePath);

    // Validações de segurança
    if (!filePath.startsWith(modulesBasePath)) {
      console.error('❌ Tentativa de acesso fora do diretório de módulos');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Validar se arquivo existe
    if (!existsSync(filePath)) {
      console.error('❌ Arquivo não encontrado:', filePath);
      return NextResponse.json(
        { error: `Arquivo não encontrado: ${path.join('/')}` },
        { status: 404 }
      );
    }

    // Detectar tipo MIME baseado na extensão
    const ext = extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.html': 'text/html',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Validar extensões permitidas (segurança)
    const allowedExtensions = ['.js', '.json', '.css', '.md', '.txt'];
    if (!allowedExtensions.includes(ext)) {
      console.error('❌ Extensão de arquivo não permitida:', ext);
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido' },
        { status: 403 }
      );
    }

    // Ler e retornar o arquivo
    const fileContent = await readFile(filePath, 'utf-8');
    console.log('✅ Arquivo carregado com sucesso:', filePath);

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache de 1 hora
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('❌ Erro ao servir arquivo do módulo:', error);

    return NextResponse.json(
      {
        error: 'Erro ao carregar arquivo',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
