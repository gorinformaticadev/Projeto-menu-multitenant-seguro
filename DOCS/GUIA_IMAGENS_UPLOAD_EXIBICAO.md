# Guia de Implementação: Upload e Exibição de Imagens (Multi-Tenant)

Este guia documenta o padrão robusto implementado para upload, armazenamento seguro e exibição de imagens no sistema, garantindo compatibilidade com o NestJS (Backend) e Next.js (Frontend).

## 1. Visão Geral da Arquitetura

*   **Fluxo de Upload**: Frontend -> Envia `FormData` -> Controller Backend -> Reconstrói Buffer -> Salva em Disco (Pasta Isolada).
*   **Fluxo de Exibição**: Frontend (`<img src="...">`) -> Next.js Proxy (`next.config.js`) -> Backend Endpoint (`@Public`) -> `res.sendFile`.

---

## 2. Backend (NestJS)

### Controller: Tratamento Robusto de Buffer
O NestJS/Multer às vezes recebe o arquivo como um objeto JSON serializado em vez de um Buffer nativo. É **crucial** implementar a lógica de recuperação.

```typescript
// modules/seu-modulo/backend/controllers/seu.controller.ts

@Post('upload')
@UseInterceptors(FileInterceptor('file')) // 'file' é o nome do campo no FormData
async uploadFile(@UploadedFile() file: any, @Req() req) {
    // 1. Recuperação e Validação do Buffer
    let bufferData = file.buffer;
    
    // Verifica se "parece" um buffer, mas é um objeto (JSON)
    if (bufferData && typeof bufferData === 'object' && !Buffer.isBuffer(bufferData)) {
        if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
            // Caso A: { type: 'Buffer', data: [...] }
            bufferData = Buffer.from(bufferData.data);
        } else {
            // Caso B: Objeto Array-Like { '0': 255, '1': 10... }
            const values = Object.values(bufferData) as number[];
            bufferData = Buffer.from(values);
        }
    }
    
    // Verifica Fallback para arquivo em disco (se Multer configurado diferente)
    if ((!bufferData || !Buffer.isBuffer(bufferData)) && file.path) {
        bufferData = fs.readFileSync(file.path);
    }

    if (!Buffer.isBuffer(bufferData)) {
        throw new Error('Falha crítica: Buffer inválido.');
    }

    // 2. Caminho Seguro e Isolado por Tenant
    const tenantId = req.user?.tenantId || 'global';
    // Path: apps/backend/uploads/modules/{modulo}/{tenantId}
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'modules', 'seu_modulo', tenantId);
    
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // 3. Salvar Arquivo
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, bufferData);

    // 4. Retornar URL Pública (via Proxy API)
    return { url: `/api/seu_modulo/recurso/uploads/${tenantId}/${uniqueName}` };
}
```

### Controller: Servir o Arquivo (Endpoint @Public)
Para que a tag `<img>` funcione sem cabeçalhos de autenticação complexos, o endpoint de leitura deve ser público.

```typescript
import { Public } from '@core/decorators/public.decorator';

@Get('uploads/:tenantId/:filename')
@Public() // <--- CRÍTICO: Permite acesso sem token Bearer
async serveFile(@Param('filename') filename: string, @Param('tenantId') tenantId: string, @Res() res: Response) {
    const filePath = path.resolve(process.cwd(), 'uploads', 'modules', 'seu_modulo', tenantId, filename);
    
    // Segurança contra Path Traversal
    if (!filePath.startsWith(path.resolve(process.cwd(), 'uploads', 'modules', 'seu_modulo'))) {
         return res.status(403).json({ message: 'Acesso negado' });
    }

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ message: 'Arquivo não encontrado' });
    }
}
```

---

## 3. Frontend (Next.js & React)

### Envio (Upload)
Use `FormData` e não envie cabeçalho `Content-Type` manual (o navegador define o boundary).

```typescript
const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file); // O nome 'file' deve bater com o FileInterceptor no backend

    const response = await api.post('/api/seu_modulo/recurso/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data', // Axios detecta, mas explícito ajuda
        },
    });

    return response.data.url; // Salve essa URL no banco
};
```

### Exibição
A URL retornada (`/api/...`) é relativa. O Proxy do Next.js cuidará de buscar no Backend.

```tsx
// Exemplo de componente
<img 
    src={produto.image_url} // Ex: "/api/ordem_servico/produtos/uploads/tenant-123/img.jpg"
    alt="Produto" 
    onError={(e) => e.currentTarget.src = '/placeholder.png'} // Fallback importante
/>
```

---

## 4. Configuração do Next.js (Proxy)

Para evitar erros de CORS e 404, o Next.js deve redirecionar as chamadas de `/api` para o Backend (`localhost:4000`).

Arquivo: `apps/frontend/next.config.js`

```javascript
module.exports = {
  // ... outras configs
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*', // Redireciona tudo de /api para o Backend
      },
      // Opcional: Se tiver rota direta de uploads
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:4000/uploads/:path*',
      },
    ];
  },
};
```

## Resumo de Possíveis Erros e Soluções

| Sintoma | Causa Provável | Solução |
| :--- | :--- | :--- |
| **Erro 500 no Upload (TypeError)** | Buffer chegando como Objeto JSON | Implementar lógica de `Buffer.from(data)` (ver seção 2). |
| **Erro 404 na Imagem** | Backend bloqueando acesso (Auth) | Adicionar `@Public()` no endpoint `serveFile`. |
| **Erro 404 na Imagem (Console)** | URL não chegando no Backend | Verificar `rewrites` no `next.config.js`. |
| **Imagem não salva** | Permissão de pasta | Usar `process.cwd()` e garantir `fs.mkdirSync({ recursive: true })`. |
