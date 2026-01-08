# Guia de Implementação: Upload e Exibição de Imagens (Multi-Tenant)

Este guia documenta o padrão robusto implementado para upload, armazenamento seguro e exibição de imagens no sistema, garantindo compatibilidade entre NestJS (Backend) e Next.js (Frontend) via Proxy.

## 1. Visão Geral da Arquitetura

*   **Fluxo de Upload**: Frontend -> Envia `FormData` -> API Gateway/Proxy (`/api/...`) -> Controller Backend -> Reconstrói Buffer -> Salva em Disco (Tenant-Isolated).
*   **Fluxo de Exibição**: Frontend (`<img src="...">`) -> Next.js Proxy (`/api/...`) -> Backend Endpoint (`@Public`) -> `res.sendFile`.

---

## 2. Backend (NestJS)

### Controller: Tratamento Robusto de Buffer
O NestJS/Multer pode receber o arquivo de diferentes formas dependendo da configuração. Use esta lógica para garantir que o buffer seja extraído corretamente.

```typescript
// modules/seu-modulo/backend/controllers/seu.controller.ts

@Post('upload')
@UseInterceptors(FileInterceptor('file')) // 'file' deve ser a chave no FormData
async uploadFile(@UploadedFile() file: any, @Req() req: ExpressRequest & { user: any }) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    // 1. Recuperação do Buffer (Crucial para JSON serializado)
    let bufferData = file.buffer;
    if (bufferData && typeof bufferData === 'object' && !Buffer.isBuffer(bufferData)) {
        if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
            bufferData = Buffer.from(bufferData.data);
        } else {
            const values = Object.values(bufferData) as number[];
            bufferData = Buffer.from(values);
        }
    }

    // Fallback para arquivo em cache de disco
    if ((!bufferData || !Buffer.isBuffer(bufferData)) && file.path) {
        bufferData = fs.readFileSync(file.path);
    }

    if (!Buffer.isBuffer(bufferData)) {
        throw new Error('Falha crítica: Buffer inválido.');
    }

    // 2. Caminho Isolado por Tenant
    const tenantId = req.user?.tenantId || 'global';
    // Padrão: uploads/modules/{contexto}/{recurso}/{tenantId}
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'modules', 'seu_modulo', 'seu_recurso', tenantId);
    
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // 3. Salvar Arquivo
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, bufferData);

    // 4. Retornar URL Pública (IMPORTANTE: Começar com /api para o Proxy)
    return { url: `/api/seu_modulo/seu_recurso/uploads/${tenantId}/${uniqueName}` };
}
```

### Controller: Servir o Arquivo (Endpoint Público)
O endpoint de leitura deve ser `@Public()` para que as tags `<img>` funcionem sem passar headers de autenticação.

```typescript
import { Public } from '@core/common/decorators/public.decorator';

@Get('uploads/:tenantId/:filename')
@Public()
async serveFile(@Param('filename') filename: string, @Param('tenantId') tenantId: string, @Res() res: Response) {
    const filePath = path.resolve(process.cwd(), 'uploads', 'modules', 'seu_modulo', 'seu_recurso', tenantId, filename);
    
    // Segurança contra Path Traversal
    const baseDir = path.resolve(process.cwd(), 'uploads', 'modules', 'seu_modulo', 'seu_recurso');
    if (!filePath.startsWith(baseDir)) {
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

### Envio de Imagem (Upload)
Use `FormData` e **sempre** inclua o prefixo `/api` na URL para que o `next.config.js` faça o redirecionamento para o backend (porta 4000).

```typescript
const handleUpload = async (imageBlob: Blob, fileName: string) => {
    const formData = new FormData();
    formData.append('file', imageBlob, fileName);

    // ✅ CORRETO: Começa com /api para ativar o Proxy do Next.js
    const response = await api.post('/api/seu_modulo/seu_recurso/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data.url; // Retorna ex: "/api/seu_modulo/uploads/..."
};
```

### Exibição de Imagem
As URLs já vêm do banco prontas para serem usadas diretamente no `src` da imagem.

```tsx
<img 
    src={item.image_url} // Ex: "/api/ordem_servico/produtos/uploads/tenant-hex/123.jpg"
    alt="Preview" 
    className="h-10 w-10 object-cover"
    onError={(e) => e.currentTarget.src = '/placeholder-avatar.png'} 
/>
```

---

## 4. Configuração do Proxy (next.config.js)

O arquivo `apps/frontend/next.config.js` é o coração dessa integração. Ele garante que qualquer requisição para `/api` no frontend chegue ao backend local.

```javascript
// apps/frontend/next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      }
    ];
  },
};
```

---

## Resumo de Regras de Ouro

1.  **Prefixos**: Todo endpoint no `Controller` que começa com `api/` deve ser chamado no frontend com `/api/`.
2.  **Publicidade**: Imagens para exibição (`serveFile`) devem usar `@Public()`.
3.  **Segregação**: Pastas de upload devem incluir o `tenantId` para isolamento de dados.
4.  **Buffer**: Sempre extraia o buffer manualmente no Controller para evitar erros de serialização Multer.
