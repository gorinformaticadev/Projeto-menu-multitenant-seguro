import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { ConfigService } from '@nestjs/config';

/**
 * Serviço Executor de Banco de Dados para Módulos
 * Usa pg.Pool para execução segura de SQL com transações e rollback automático
 */
@Injectable()
export class ModuleDatabaseExecutorService {
    private readonly logger = new Logger(ModuleDatabaseExecutorService.name);
    private pool: Pool;

    constructor(private configService: ConfigService) {
        this.initializePool();
    }

    /**
     * Inicializa o pool de conexões PostgreSQL
     */
    private initializePool() {
        const databaseUrl = this.configService.get<string>('DATABASE_URL');

        if (!databaseUrl) {
            throw new Error('DATABASE_URL não configurada');
        }

        this.pool = new Pool({
            connectionString: databaseUrl,
            max: 10, // Máximo de conexões
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            this.logger.error('Erro inesperado no pool PostgreSQL:', err);
        });

        this.logger.log('✅ Pool PostgreSQL inicializado para executor de módulos');
    }

    /**
     * Executa SQL completo em transação com rollback automático
     * BEGIN → EXECUTE → COMMIT ou ROLLBACK em erro
     */
    async executeInTransaction(sql: string, tenantId?: string): Promise<void> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Se tenantId fornecido, configura isolamento
            if (tenantId) {
                await this.setTenantContext(client, tenantId);
            }

            // Executa o SQL completo
            await client.query(sql);

            await client.query('COMMIT');
            this.logger.log('✅ Transação executada com sucesso');

        } catch (error) {
            await client.query('ROLLBACK');
            this.logger.error('❌ Erro na transação, rollback executado:', error.message);
            throw new BadRequestException(`Erro ao executar SQL: ${error.message}`);
        } finally {
            client.release();
        }
    }

    /**
     * Executa múltiplas queries SQL em uma única transação
     */
    async executeMultipleInTransaction(queries: string[], tenantId?: string): Promise<void> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            if (tenantId) {
                await this.setTenantContext(client, tenantId);
            }

            for (const query of queries) {
                if (query.trim()) {
                    await client.query(query);
                }
            }

            await client.query('COMMIT');
            this.logger.log(`✅ ${queries.length} queries executadas em transação`);

        } catch (error) {
            await client.query('ROLLBACK');
            this.logger.error('❌ Erro em transação múltipla, rollback executado:', error.message);
            throw new BadRequestException(`Erro ao executar queries: ${error.message}`);
        } finally {
            client.release();
        }
    }

    /**
     * Executa query e retorna resultados
     */
    async executeQuery<T = any>(sql: string, params: any[] = [], tenantId?: string): Promise<T[]> {
        const client = await this.pool.connect();

        try {
            if (tenantId) {
                await this.setTenantContext(client, tenantId);
            }

            const result = await client.query(sql, params);
            return result.rows;

        } catch (error) {
            this.logger.error('❌ Erro ao executar query:', error.message);
            throw new BadRequestException(`Erro na query: ${error.message}`);
        } finally {
            client.release();
        }
    }

    /**
     * Verifica se tabela existe
     */
    async tableExists(tableName: string, tenantId?: string): Promise<boolean> {
        const query = `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = $1
            )
        `;

        const result = await this.executeQuery<{ exists: boolean }>(query, [tableName], tenantId);
        return result[0]?.exists || false;
    }

    /**
     * Configura contexto do tenant para isolamento
     */
    private async setTenantContext(client: PoolClient, tenantId: string): Promise<void> {
        // Configura variável de sessão para isolamento por tenant
        await client.query('SET app.tenant_id = $1', [tenantId]);
        this.logger.debug(`🔒 Contexto tenant configurado: ${tenantId}`);
    }

    /**
     * Fecha o pool de conexões
     */
    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.logger.log('🔌 Pool PostgreSQL fechado');
        }
    }

    /**
     * Health check do pool
     */
    async healthCheck(): Promise<boolean> {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            return true;
        } catch (error) {
            this.logger.error('❌ Health check do pool falhou:', error.message);
            return false;
        }
    }
}
