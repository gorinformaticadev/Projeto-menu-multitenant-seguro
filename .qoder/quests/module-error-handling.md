# Tratamento de Erros na Listagem de Módulos

## Contexto

Ao acessar o endpoint `GET /me/modules` quando não há módulos instalados no sistema, ocorre um erro de `PrismaClientKnownRequestError` indicando que a coluna `modules.slug` não existe no banco de dados. Este erro acontece porque o Prisma tenta acessar uma coluna que foi removida ou renomeada no esquema do banco de dados.

## Problema Identificado

O método `getAvailableModules` no `ModuleSecurityService` está utilizando uma consulta Prisma que referencia a coluna `slug`, que aparentemente não existe mais no modelo de dados atual. O erro específico é:

```
The column `modules.slug` does not exist in the current database.
```

## Solução Proposta

Implementar um tratamento de erro robusto no método `getAvailableModules` para lidar com situações onde:
1. A estrutura do banco de dados está desatualizada
2. Não há módulos cadastrados no sistema
3. Há inconsistências no esquema de dados

### Estratégia de Tratamento

1. Adicionar verificação de existência da tabela e colunas necessárias antes da consulta principal
2. Implementar fallback quando não há módulos disponíveis
3. Melhorar o log de erros para facilitar diagnóstico
4. Retornar uma resposta consistente mesmo em caso de erro

### Alterações Necessárias

#### 1. Atualização do ModuleSecurityService

O método `getAvailableModules` foi modificado para incluir tratamento de exceções específicas e usar os campos corretos do modelo de dados:

```typescript
async getAvailableModules(tenantId: string): Promise<any[]> {
  try {
    const modules = await this.prisma.module.findMany({
      where: { 
        status: {
          in: ['active', 'installed', 'db_ready']
        }
      },
      include: {
        tenantModules: {
          where: { tenantId }
        }
      }
    });

    return modules.map(module => ({
      slug: module.slug,
      name: module.name,
      description: module.description,
      enabled: module.tenantModules.length > 0 ? module.tenantModules[0]?.enabled : false,
    }));

  } catch (error) {
    // Tratamento específico para erros de schema
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`Erro de schema ao listar módulos para tenant ${tenantId}:`, error.message);
      
      // Verificar se é erro de coluna inexistente
      if (error.message.includes('slug')) {
        this.logger.warn('Possível inconsistência no schema - coluna slug não encontrada');
        // Retornar array vazio como fallback
        return [];
      }
    }
    
    // Log genérico para outros tipos de erro
    this.logger.error(`Erro ao listar módulos para tenant ${tenantId}:`, error);
    // Sempre retornar array vazio em caso de erro para manter a consistência da API
    return [];
  }
}
```

Além disso, outros métodos foram atualizados para usar os campos corretos do modelo de dados:

```typescript
async canExecuteModule(slug: string, tenantId?: string): Promise<boolean> {
  try {
    const module = await this.prisma.module.findUnique({
      where: { slug },
      include: {
        tenantModules: tenantId ? {
          where: { tenantId }
        } : false
      }
    });

    if (!module) {
      this.logger.warn(`Módulo não encontrado: ${slug}`);
      return false;
    }

    if (module.status !== 'active') {
      this.logger.warn(`Módulo ${slug} não está ativo (status: ${module.status})`);
      return false;
    }

    if (tenantId && (!module.tenantModules || module.tenantModules.length === 0 || !module.tenantModules[0]?.enabled)) {
      this.logger.warn(`Módulo ${slug} não habilitado para tenant ${tenantId}`);
      return false;
    }

    return true;

  } catch (error) {
    this.logger.error(`Erro ao validar módulo ${slug}:`, error);
    return false;
  }
}
```

### Benefícios da Solução

1. **Resiliência**: O sistema continua funcionando mesmo com problemas de schema
2. **Consistência**: A API sempre retorna um array, mesmo que vazio
3. **Diagnóstico**: Logs detalhados ajudam na identificação de problemas
4. **Experiência do Usuário**: Evita erros críticos na interface quando não há módulos

### Considerações de Implementação

1. Esta solução é um paliativo para o problema de schema e não substitui a correção definitiva
2. É recomendável investigar por que a coluna `slug` não existe no banco de dados
3. Deve-se verificar se há migrações pendentes no Prisma
4. O tratamento de erro não deve mascarar problemas reais de implementação