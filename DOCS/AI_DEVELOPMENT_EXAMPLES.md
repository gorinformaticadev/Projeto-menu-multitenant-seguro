# 🎯 Exemplos Práticos para IA - Desenvolvimento

## 📋 Exemplos de Implementação Correta

### 1. **Criando um Novo Serviço (Backend)**

#### ✅ Estrutura Correta
```typescript
/**
 * Serviço para gerenciar notificações do sistema
 * Implementa envio de notificações com isolamento multitenant
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  /**
   * Cria uma nova notificação para um usuário
   * @param userId - ID do usuário destinatário
   * @param data - Dados da notificação
   * @returns Promise com a notificação criada
   * @throws BadRequestException se dados inválidos
   */
  async createNotification(
    userId: string, 
    data: CreateNotificationDto
  ): Promise<Notification> {
    try {
      // Validar se usuário existe
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // Criar notificação
      const notification = await this.prisma.notification.create({
        data: {
          ...data,
          userId,
          createdAt: new Date()
        }
      });

      this.logger.log(`Notification created for user ${userId}`);
      return notification;

    } catch (error) {
      this.logger.error('Failed to create notification:', error);
      throw new BadRequestException('Erro ao criar notificação');
    }
  }
}
```

### 2. **Criando um Novo Componente (Frontend)**

#### ✅ Estrutura Correta
```typescript
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

/**
 * Componente para exibir lista de notificações do usuário
 * Permite marcar como lida e remover notificações
 */
export default function NotificationList() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Carrega notificações do usuário atual
   * Implementa cache local para melhor performance
   */
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const response = await api.get('/notifications');
        setNotifications(response.data);
      } catch (error) {
        toast({
          title: "Erro ao carregar notificações",
          description: "Tente novamente em alguns instantes",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [toast]);

  /**
   * Marca notificação como lida
   * @param notificationId - ID da notificação
   */
  const markAsRead = async (notificationId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      
      // Atualizar estado local
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );

      toast({
        title: "Notificação marcada como lida",
      });
    } catch (error) {
      toast({
        title: "Erro ao marcar notificação",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            Nenhuma notificação encontrada
          </p>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${
                  notification.read ? 'bg-gray-50' : 'bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  
                  {!notification.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAsRead(notification.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 3. **Criando um Hook Personalizado**

#### ✅ Hook Reutilizável
```typescript
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook para gerenciar notificações do usuário
 * Fornece estado, ações e cache automático
 */
export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Busca notificações da API
   * Implementa cache e tratamento de erros
   */
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Marca notificação específica como lida
   */
  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      throw new Error('Erro ao marcar notificação como lida');
    }
  }, []);

  /**
   * Marca todas as notificações como lidas
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      throw new Error('Erro ao marcar todas como lidas');
    }
  }, []);

  // Carregar notificações na inicialização
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Calcular contador de não lidas
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
```

### 4. **Criando um DTO com Validação**

#### ✅ DTO Completo
```typescript
import { 
  IsString, 
  IsEmail, 
  IsOptional, 
  IsEnum, 
  MinLength, 
  MaxLength,
  Matches,
  IsUUID
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

/**
 * DTO para criação de notificação
 * Implementa validação completa e sanitização
 */
export class CreateNotificationDto {
  @IsString()
  @MinLength(3, { message: 'Título deve ter pelo menos 3 caracteres' })
  @MaxLength(100, { message: 'Título deve ter no máximo 100 caracteres' })
  @Transform(({ value }) => value?.trim()) // Sanitização
  title: string;

  @IsString()
  @MinLength(10, { message: 'Mensagem deve ter pelo menos 10 caracteres' })
  @MaxLength(500, { message: 'Mensagem deve ter no máximo 500 caracteres' })
  @Transform(({ value }) => value?.trim())
  message: string;

  @IsEnum(NotificationType, { 
    message: 'Tipo deve ser INFO, WARNING, ERROR ou SUCCESS' 
  })
  type: NotificationType;

  @IsOptional()
  @IsUUID('4', { message: 'ID do usuário deve ser um UUID válido' })
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metadata?: string; // JSON string para dados extras
}

/**
 * DTO para atualização de notificação
 */
export class UpdateNotificationDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  message?: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}

/**
 * DTO para resposta de notificação
 * Remove campos sensíveis
 */
export class NotificationResponseDto {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Campos do usuário (se necessário)
  user?: {
    id: string;
    name: string;
    email: string;
    // ❌ Nunca incluir: password, tokens, etc.
  };
}
```

### 5. **Implementando Testes**

#### ✅ Teste de Serviço
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaService: PrismaService;
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
            notification: { create: jest.fn(), findMany: jest.fn() }
          }
        },
        {
          provide: EmailService,
          useValue: { sendNotificationEmail: jest.fn() }
        }
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prismaService = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const notificationData = {
        title: 'Test Notification',
        message: 'Test message',
        type: NotificationType.INFO
      };

      const mockUser = { id: userId, email: 'test@example.com' };
      const mockNotification = { id: 'notif-123', ...notificationData, userId };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);
      jest.spyOn(prismaService.notification, 'create').mockResolvedValue(mockNotification);

      // Act
      const result = await service.createNotification(userId, notificationData);

      // Assert
      expect(result).toEqual(mockNotification);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId }
      });
      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...notificationData,
          userId,
          createdAt: expect.any(Date)
        })
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const userId = 'invalid-user';
      const notificationData = {
        title: 'Test',
        message: 'Test message',
        type: NotificationType.INFO
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createNotification(userId, notificationData)
      ).rejects.toThrow('Usuário não encontrado');
    });
  });
});
```

---

## 🌐 Exemplos de Internacionalização

### ✅ Estrutura de Mensagens
```typescript
// src/common/i18n/messages.ts
export const MESSAGES = {
  'pt-BR': {
    // Autenticação
    'auth.login.success': 'Login realizado com sucesso',
    'auth.login.error': 'Email ou senha incorretos',
    'auth.logout.success': 'Logout realizado com sucesso',
    'auth.2fa.required': 'Código de autenticação de dois fatores obrigatório',
    
    // Usuários
    'user.created': 'Usuário criado com sucesso',
    'user.updated': 'Usuário atualizado com sucesso',
    'user.deleted': 'Usuário removido com sucesso',
    'user.not.found': 'Usuário não encontrado',
    
    // Notificações
    'notification.created': 'Notificação criada com sucesso',
    'notification.marked.read': 'Notificação marcada como lida',
    'notification.all.read': 'Todas as notificações marcadas como lidas',
    
    // Erros gerais
    'error.internal': 'Erro interno do servidor',
    'error.validation': 'Dados inválidos fornecidos',
    'error.unauthorized': 'Acesso não autorizado',
    'error.forbidden': 'Você não tem permissão para esta ação'
  },
  
  'es-ES': {
    // Autenticación
    'auth.login.success': 'Inicio de sesión exitoso',
    'auth.login.error': 'Email o contraseña incorrectos',
    'auth.logout.success': 'Cierre de sesión exitoso',
    'auth.2fa.required': 'Código de autenticación de dos factores requerido',
    
    // Usuarios
    'user.created': 'Usuario creado exitosamente',
    'user.updated': 'Usuario actualizado exitosamente',
    'user.deleted': 'Usuario eliminado exitosamente',
    'user.not.found': 'Usuario no encontrado',
    
    // Notificaciones
    'notification.created': 'Notificación creada exitosamente',
    'notification.marked.read': 'Notificación marcada como leída',
    'notification.all.read': 'Todas las notificaciones marcadas como leídas',
    
    // Errores generales
    'error.internal': 'Error interno del servidor',
    'error.validation': 'Datos inválidos proporcionados',
    'error.unauthorized': 'Acceso no autorizado',
    'error.forbidden': 'No tienes permiso para esta acción'
  },
  
  'en-US': {
    // Authentication
    'auth.login.success': 'Login successful',
    'auth.login.error': 'Incorrect email or password',
    'auth.logout.success': 'Logout successful',
    'auth.2fa.required': 'Two-factor authentication code required',
    
    // Users
    'user.created': 'User created successfully',
    'user.updated': 'User updated successfully',
    'user.deleted': 'User deleted successfully',
    'user.not.found': 'User not found',
    
    // Notifications
    'notification.created': 'Notification created successfully',
    'notification.marked.read': 'Notification marked as read',
    'notification.all.read': 'All notifications marked as read',
    
    // General errors
    'error.internal': 'Internal server error',
    'error.validation': 'Invalid data provided',
    'error.unauthorized': 'Unauthorized access',
    'error.forbidden': 'You do not have permission for this action'
  }
} as const;

// Tipo para garantir consistência
export type MessageKey = keyof typeof MESSAGES['pt-BR'];
export type Language = keyof typeof MESSAGES;

/**
 * Função para obter mensagem traduzida
 * @param key - Chave da mensagem
 * @param lang - Idioma (padrão: pt-BR)
 * @returns Mensagem traduzida
 */
export function getMessage(key: MessageKey, lang: Language = 'pt-BR'): string {
  return MESSAGES[lang][key] || MESSAGES['pt-BR'][key] || key;
}
```

---

## 📊 Exemplos de Performance

### ✅ Otimização de Queries
```typescript
// ❌ Evitar N+1 queries
async getBadUserList() {
  const users = await this.prisma.user.findMany();
  
  for (const user of users) {
    user.tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId }
    }); // Múltiplas queries!
  }
  
  return users;
}

// ✅ Query otimizada
async getOptimizedUserList() {
  return this.prisma.user.findMany({
    include: {
      tenant: true, // Uma única query com JOIN
      _count: {
        select: {
          notifications: true // Contar relacionamentos
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50 // Limitar resultados
  });
}

// ✅ Paginação eficiente
async getUsersPaginated(page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;
  
  const [users, total] = await Promise.all([
    this.prisma.user.findMany({
      skip,
      take: limit,
      include: { tenant: true },
      orderBy: { createdAt: 'desc' }
    }),
    this.prisma.user.count() // Query separada para total
  ]);
  
  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}
```

### ✅ Cache Inteligente
```typescript
/**
 * Serviço com cache Redis para melhor performance
 */
@Injectable()
export class CachedUserService {
  private readonly CACHE_TTL = 300; // 5 minutos
  
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService
  ) {}

  /**
   * Busca usuário com cache automático
   */
  async getUserById(id: string): Promise<User | null> {
    const cacheKey = `user:${id}`;
    
    // Tentar buscar no cache primeiro
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Buscar no banco se não estiver em cache
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tenant: true }
    });
    
    // Salvar no cache se encontrado
    if (user) {
      await this.cacheService.set(
        cacheKey, 
        JSON.stringify(user), 
        this.CACHE_TTL
      );
    }
    
    return user;
  }

  /**
   * Invalida cache ao atualizar usuário
   */
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: { tenant: true }
    });
    
    // Invalidar cache
    await this.cacheService.del(`user:${id}`);
    
    return user;
  }
}
```

---

## 🔒 Exemplos de Segurança Avançada

### ✅ Rate Limiting Personalizado
```typescript
/**
 * Guard personalizado para rate limiting por usuário
 */
@Injectable()
export class UserRateLimitGuard implements CanActivate {
  constructor(private cacheService: CacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    
    if (!userId) return true; // Deixar outros guards tratarem auth
    
    const key = `rate_limit:${userId}`;
    const current = await this.cacheService.get(key);
    const limit = 100; // 100 requests por hora
    const window = 3600; // 1 hora
    
    if (current && parseInt(current) >= limit) {
      throw new ThrottlerException('Muitas requisições. Tente novamente em 1 hora.');
    }
    
    // Incrementar contador
    const count = current ? parseInt(current) + 1 : 1;
    await this.cacheService.set(key, count.toString(), window);
    
    return true;
  }
}

// Uso no controller
@UseGuards(JwtAuthGuard, UserRateLimitGuard)
@Controller('api')
export class ApiController {
  // Endpoints protegidos por rate limiting
}
```

### ✅ Sanitização Avançada
```typescript
/**
 * Pipe personalizado para sanitização de HTML
 */
@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') {
      // Remover tags HTML perigosas
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    
    if (typeof value === 'object' && value !== null) {
      // Sanitizar recursivamente objetos
      const sanitized = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.transform(val);
      }
      return sanitized;
    }
    
    return value;
  }
}

// Uso no DTO
export class CreatePostDto {
  @IsString()
  @Transform(({ value }) => new SanitizeHtmlPipe().transform(value))
  content: string;
}
```

---

**💡 Lembre-se: Estes exemplos devem ser adaptados conforme a necessidade específica, sempre seguindo as regras de segurança e performance estabelecidas no projeto.**