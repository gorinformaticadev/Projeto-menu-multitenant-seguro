/**
 * API ROUTE PARA SERVIR ARQUIVOS DE MÓDULOS
 * 
 * Serve arquivos JavaScript dos módulos independentes
 * Rota: /api/modules/[...path]
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Construir caminho do arquivo
    const filePath = params.path.join('/');
    
    // Corrigir o caminho - a API roda no contexto do frontend, mas os módulos estão na raiz
    const projectRoot = join(process.cwd(), '..');
    const fullPath = join(projectRoot, 'modules', filePath);
    
    console.log('📁 Tentando carregar arquivo:', fullPath);
    console.log('📂 Diretório de trabalho:', process.cwd());
    console.log('📂 Raiz do projeto:', projectRoot);
    console.log('🔍 Caminho solicitado:', filePath);
    
    // Verificar se arquivo existe
    if (!existsSync(fullPath)) {
      console.error('❌ Arquivo não encontrado:', fullPath);
      
      // Listar arquivos na pasta modules para debug
      try {
        const { readdirSync } = require('fs');
        const modulesDir = join(projectRoot, 'modules');
        console.log('📂 Conteúdo da pasta modules:', readdirSync(modulesDir, { recursive: true }));
      } catch (e) {
        console.error('❌ Erro ao listar pasta modules:', e.message);
      }
      
      return NextResponse.json(
        { error: 'Arquivo não encontrado', path: fullPath },
        { status: 404 }
      );
    }
    
    // Verificar se é um arquivo permitido
    const allowedExtensions = ['.js', '.json', '.md'];
    const hasAllowedExtension = allowedExtensions.some(ext => 
      fullPath.toLowerCase().endsWith(ext)
    );
    
    if (!hasAllowedExtension) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido' },
        { status: 403 }
      );
    }
    
    // Ler arquivo
    console.log('✅ Arquivo encontrado, lendo conteúdo...');
    const fileContent = await readFile(fullPath, 'utf-8');
    console.log('📄 Arquivo lido com sucesso, tamanho:', fileContent.length);
    
    // Determinar Content-Type
    let contentType = 'text/plain';
    if (fullPath.endsWith('.js')) {
      contentType = 'application/javascript';
    } else if (fullPath.endsWith('.json')) {
      contentType = 'application/json';
    } else if (fullPath.endsWith('.md')) {
      contentType = 'text/markdown';
    }
    
    // Retornar arquivo com headers corretos
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
  } catch (error) {
    console.error('Erro ao servir arquivo do módulo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}