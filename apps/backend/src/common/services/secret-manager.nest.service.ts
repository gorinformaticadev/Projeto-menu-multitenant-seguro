import { Injectable, OnModuleInit } from '@nestjs/common';
import { 
  SecretManagerFactory, 
  SecretLoaderMiddleware,
  SecretManager as ISecretManager,
  Secret
} from './secret-manager.service';

@Injectable()
export class SecretManagerService implements OnModuleInit {
  private secretManager: ISecretManager | null = null;
  private isInitialized = false;

  async onModuleInit() {
    await this.initialize();
  }

  /**
   * Inicializa o secret manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.secretManager = await SecretManagerFactory.createSecretManager();
      
      // Carregar secrets da aplicação
      await SecretLoaderMiddleware.loadSecrets();
      
      this.isInitialized = true;
      console.log(`✅ Secret Manager inicializado (${this.secretManager.getProviderName()})`);
    } catch (error) {
      console.error('❌ Falha ao inicializar Secret Manager:', error.message);
      throw error;
    }
  }

  /**
   * Obtém um secret pelo nome
   */
  async getSecret(name: string): Promise<Secret | null> {
    if (!this.secretManager) {
      throw new Error('Secret Manager não inicializado');
    }
    
    return await this.secretManager.getSecret(name);
  }

  /**
   * Cria ou atualiza um secret
   */
  async putSecret(name: string, value: string, description?: string): Promise<Secret> {
    if (!this.secretManager) {
      throw new Error('Secret Manager não inicializado');
    }
    
    return await this.secretManager.putSecret(name, value, description);
  }

  /**
   * Deleta um secret
   */
  async deleteSecret(name: string): Promise<boolean> {
    if (!this.secretManager) {
      throw new Error('Secret Manager não inicializado');
    }
    
    return await this.secretManager.deleteSecret(name);
  }

  /**
   * Lista secrets com prefixo opcional
   */
  async listSecrets(prefix?: string): Promise<Secret[]> {
    if (!this.secretManager) {
      throw new Error('Secret Manager não inicializado');
    }
    
    return await this.secretManager.listSecrets(prefix);
  }

  /**
   * Verifica disponibilidade do secret manager
   */
  async isAvailable(): Promise<boolean> {
    if (!this.secretManager) return false;
    return await this.secretManager.isAvailable();
  }

  /**
   * Obtém o nome do provedor
   */
  getProviderName(): string {
    if (!this.secretManager) return 'Unknown';
    return this.secretManager.getProviderName();
  }

  /**
   * Carrega secrets específicos para a aplicação
   */
  async loadApplicationSecrets(): Promise<void> {
    if (!this.secretManager) {
      throw new Error('Secret Manager não inicializado');
    }

    const secretsToLoad = [
      'JWT_SECRET',
      'ENCRYPTION_KEY', 
      'DATABASE_URL',
      'SMTP_PASSWORD',
      'SENTRY_DSN'
    ];

    for (const secretName of secretsToLoad) {
      try {
        const secret = await this.getSecret(secretName);
        if (secret?.value) {
          process.env[secretName] = secret.value;
          } else {
          console.warn(`  ⚠️  ${secretName} não encontrado`);
        }
      } catch (error) {
        console.error(`  ❌ Erro ao carregar ${secretName}:`, error.message);
      }
    }
  }

  /**
   * Valida se todos os secrets críticos estão presentes
   */
  validateCriticalSecrets(): boolean {
    const criticalSecrets = [
      'JWT_SECRET',
      'ENCRYPTION_KEY'
    ];

    let allPresent = true;
    
    for (const secretName of criticalSecrets) {
      if (!process.env[secretName]) {
        console.error(`❌ Secret crítico ausente: ${secretName}`);
        allPresent = false;
      }
    }

    return allPresent;
  }

  /**
   * Método para uso em ambientes de desenvolvimento
   * Permite definir secrets localmente para testes
   */
  async setDevelopmentSecret(name: string, value: string): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('setDevelopmentSecret só pode ser usado em ambiente de desenvolvimento');
    }

    await this.putSecret(name, value, `Desenvolvimento - ${new Date().toISOString()}`);
    process.env[name] = value;
    }

  /**
   * Limpa secrets sensíveis da memória (quando possível)
   */
  clearSensitiveData(): void {
    // Esta é uma operação limitada pois process.env é global
    // Em produção, considere usar técnicas mais avançadas
    console.log('🧹 Limpando dados sensíveis da memória (limitado)');
  }
}