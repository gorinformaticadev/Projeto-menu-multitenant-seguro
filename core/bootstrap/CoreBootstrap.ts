/**
 * Bootstrap - Inicialização do CORE
 * Exemplo de como inicializar a plataforma modular
 */

import { ModuleLoader } from '../modules/ModuleLoader';
import { ContextFactory } from '../context/ContextFactory';
import { eventBus } from '../events/EventBus';
import { MenuManager } from '../ui/MenuManager';
import { DashboardManager } from '../ui/DashboardManager';
import { NotificationManager } from '../ui/NotificationManager';
import { ACLManager } from '../acl/ACLManager';
import { Environment } from '../contracts/types';
import type { 
  DatabaseConnection, 
  CacheManager, 
  Logger, 
  RouterManager 
} from '../context/CoreContext';

/**
 * Opções de bootstrap
 */
export interface BootstrapOptions {
  modulesPath: string;
  coreVersion: string;
  environment: Environment;
  db: DatabaseConnection;
  cache?: CacheManager;
  logger?: Logger;
  router?: RouterManager;
}

/**
 * Classe de Bootstrap do CORE
 */
export class CoreBootstrap {
  private loader?: ModuleLoader;
  private managers = {
    menu: new MenuManager(),
    dashboard: new DashboardManager(),
    notifier: new NotificationManager(),
    acl: new ACLManager(),
  };

  /**
   * Inicializa o CORE e carrega todos os módulos
   * @param options - Opções de configuração
   */
  public async boot(options: BootstrapOptions): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 CORE - Plataforma Modular Ideal');
    console.log('='.repeat(60) + '\n');

    try {
      // 1. Criar contexto de boot
      const context = ContextFactory.createBootContext({
        db: options.db,
        cache: options.cache || this.createDummyCache(),
        logger: options.logger || this.createConsoleLogger(),
        events: eventBus,
        router: options.router || this.createDummyRouter(),
        notifier: this.managers.notifier,
        menu: this.managers.menu,
        dashboard: this.managers.dashboard,
        acl: this.managers.acl,
        environment: options.environment,
      });

      // 2. Disparar evento de boot
      console.log('📡 Disparando evento core:boot...');
      await eventBus.emit('core:boot', {
        timestamp: new Date(),
        environment: options.environment,
      });

      // 3. Criar e inicializar module loader
      console.log('📦 Inicializando Module Loader...');
      this.loader = new ModuleLoader({
        modulesPath: options.modulesPath,
        coreVersion: options.coreVersion,
        failOnError: false,
      });

      // 4. Carregar todos os módulos (eles registram listeners aqui)
      const result = await this.loader.loadAll(context);

      // 5. AGORA disparar eventos de registro (módulos já estão escutando)
      console.log('\n📋 Disparando eventos de registro...');
      
      // Criar router dummy se não fornecido
      const router = options.router || this.createDummyRouter();
      
      await eventBus.emit('routes:register', {
        router,
        timestamp: new Date(),
      });

      await eventBus.emit('menu:register', {
        timestamp: new Date(),
      });

      await eventBus.emit('dashboard:register', {
        timestamp: new Date(),
      });

      await eventBus.emit('permissions:register', {
        timestamp: new Date(),
      });

      await eventBus.emit('notifications:register', {
        timestamp: new Date(),
      });

      // 6. Disparar evento de ready
      console.log('✅ Disparando evento core:ready...');
      await eventBus.emit('core:ready', {
        modules: result.loaded,
        timestamp: new Date(),
      });

      // 7. Resumo final
      console.log('\n' + '='.repeat(60));
      console.log('✅ CORE inicializado com sucesso!');
      console.log('='.repeat(60));
      console.log(`📊 Módulos carregados: ${result.loaded.length}`);
      console.log(`📊 Itens de menu: ${this.managers.menu.count()}`);
      console.log(`📊 Widgets: ${this.managers.dashboard.count()}`);
      console.log(`📊 Canais de notificação: ${this.managers.notifier.count()}`);
      console.log(`📊 Roles: ${this.managers.acl.getRoles().length}`);
      console.log(`📊 Permissões: ${this.managers.acl.getPermissions().length}`);
      console.log('='.repeat(60) + '\n');

    } catch (error) {
      console.error('❌ Erro fatal durante inicialização do CORE:', error);
      throw error;
    }
  }

  /**
   * Shutdown gracioso do sistema
   */
  public async shutdown(reason = 'Sistema desligando'): Promise<void> {
    console.log('\n🛑 Iniciando shutdown do CORE...');

    try {
      // Disparar evento de shutdown
      await eventBus.emit('core:shutdown', {
        reason,
        timestamp: new Date(),
      });

      // Descarregar módulos
      if (this.loader) {
        await this.loader.unloadAll();
      }

      // Limpar managers
      this.managers.menu.clear();
      this.managers.dashboard.clear();
      this.managers.notifier.clear();

      console.log('✅ CORE desligado com sucesso\n');
    } catch (error) {
      console.error('❌ Erro durante shutdown:', error);
      throw error;
    }
  }

  /**
   * Obtém managers do sistema
   */
  public getManagers() {
    return this.managers;
  }

  /**
   * Cria cache dummy para desenvolvimento
   */
  private createDummyCache(): CacheManager {
    const cache = new Map<string, any>();
    
    return {
      async get<T>(key: string): Promise<T | null> {
        return cache.get(key) || null;
      },
      async set(key: string, value: any): Promise<void> {
        cache.set(key, value);
      },
      async del(key: string): Promise<void> {
        cache.delete(key);
      },
      async clear(): Promise<void> {
        cache.clear();
      },
    };
  }

  /**
   * Cria logger console para desenvolvimento
   */
  private createConsoleLogger(): Logger {
    return {
      info(message: string, meta?: any): void {
        console.log(`ℹ️  ${message}`, meta || '');
      },
      error(message: string, error?: Error, meta?: any): void {
        console.error(`❌ ${message}`, error || '', meta || '');
      },
      warn(message: string, meta?: any): void {
        console.warn(`⚠️  ${message}`, meta || '');
      },
      debug(message: string, meta?: any): void {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`🔍 ${message}`, meta || '');
        }
      },
    };
  }

  /**
   * Cria router dummy para desenvolvimento
   */
  private createDummyRouter(): RouterManager {
    const routes: any[] = [];
    
    return {
      register(path: string, handler: any): void {
        routes.push({ path, handler });
        console.log(`📍 Rota registrada: ${path}`);
      },
      getRoutes(): any[] {
        return routes;
      },
    };
  }
}

/**
 * Função helper para bootstrap rápido
 */
export async function bootstrap(options: BootstrapOptions): Promise<CoreBootstrap> {
  const core = new CoreBootstrap();
  await core.boot(options);
  return core;
}
