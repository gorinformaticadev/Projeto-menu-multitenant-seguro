import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordHistoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verificar se a senha já foi usada recentemente
   */
  async isPasswordReused(userId: string, newPassword: string): Promise<{
    isReused: boolean;
    message?: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHistory) {
      return { isReused: false };
    }

    // Buscar configuração de limite de reutilização
    const securityConfig = await this.prisma.securityConfig.findFirst();
    const reuseLimit = securityConfig?.passwordReuseLimit || 5;

    try {
      const passwordHistory: string[] = JSON.parse(user.passwordHistory);

      // Verificar contra cada senha no histórico
      for (let i = 0; i < passwordHistory.length; i++) {
        const isMatch = await bcrypt.compare(newPassword, passwordHistory[i]);
        if (isMatch) {
          const positionInHistory = i + 1;
          return {
            isReused: true,
            message: `Esta senha já foi utilizada recentemente. Você não pode reutilizar as últimas ${reuseLimit} senhas.`,
          };
        }
      }

      return { isReused: false };
    } catch (error) {
      // Se houver erro ao parsear JSON, considerar que não há histórico
      return { isReused: false };
    }
  }

  /**
   * Adicionar nova senha ao histórico
   */
  async addPasswordToHistory(userId: string, hashedPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return;
    }

    // Buscar configuração de limite
    const securityConfig = await this.prisma.securityConfig.findFirst();
    const reuseLimit = securityConfig?.passwordReuseLimit || 5;

    let passwordHistory: string[] = [];

    if (user.passwordHistory) {
      try {
        passwordHistory = JSON.parse(user.passwordHistory);
      } catch (error) {
        passwordHistory = [];
      }
    }

    // Adicionar nova senha no início do array
    passwordHistory.unshift(hashedPassword);

    // Manter apenas as últimas N senhas
    if (passwordHistory.length > reuseLimit) {
      passwordHistory = passwordHistory.slice(0, reuseLimit);
    }

    // Salvar histórico atualizado
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHistory: JSON.stringify(passwordHistory),
        lastPasswordChange: new Date(),
      },
    });
  }

  /**
   * Validar requisitos de complexidade de senha
   */
  async validatePasswordComplexity(password: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const securityConfig = await this.prisma.securityConfig.findFirst();
    const errors: string[] = [];

    const minLength = securityConfig?.passwordMinLength || 8;
    const requireUppercase = securityConfig?.passwordRequireUppercase ?? true;
    const requireLowercase = securityConfig?.passwordRequireLowercase ?? true;
    const requireNumbers = securityConfig?.passwordRequireNumbers ?? true;
    const requireSpecial = securityConfig?.passwordRequireSpecial ?? true;

    if (password.length < minLength) {
      errors.push(`A senha deve ter no mínimo ${minLength} caracteres`);
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra maiúscula');
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra minúscula');
    }

    if (requireNumbers && !/\d/.test(password)) {
      errors.push('A senha deve conter pelo menos um número');
    }

    if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('A senha deve conter pelo menos um caractere especial');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Verificar se senha é comum/fraca
   */
  isCommonPassword(password: string): boolean {
    // Lista de senhas mais comuns (top 100)
    const commonPasswords = [
      '123456', 'password', '12345678', 'qwerty', '123456789', '12345',
      '1234', '111111', '1234567', 'dragon', '123123', 'baseball', 'iloveyou',
      '121212', 'trustno1', 'monkey', 'liverpoo', 'dragon', 'princess', 'qwertyuiop',
      'starwars', 'montypython', 'superman', 'michael', 'michelle', 'football',
      'password1', 'abc123', '000000', 'letmein', 'liverpool', 'master', 'sunshine',
      'ashley', 'bailey', 'passw0rd', 'shadow', 'charlie', 'qwerty123', 'admin',
      'welcome', 'solo', 'jesus', 'ninja', 'mustang', 'password123', 'freedom',
      'whatever', 'starwars', 'test', 'trustno1', 'football1', 'secret', 'love'
    ];

    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Gerar sugestões de senha forte
   */
  generatePasswordSuggestions(): string[] {
    const suggestions = [
      'Use pelo menos 12 caracteres',
      'Combine letras maiúsculas e minúsculas',
      'Inclua números e caracteres especiais',
      'Evite informações pessoais (nome, data de nascimento)',
      'Não reutilize senhas de outros serviços',
      'Use um gerenciador de senhas',
      'Considere usar uma frase-senha (passphrase)',
    ];

    return suggestions;
  }

  /**
   * Calcular força da senha
   */
  calculatePasswordStrength(password: string): {
    score: number; // 0-100
    level: 'weak' | 'medium' | 'strong' | 'very_strong';
    feedback: string[];
  } {
    let score = 0;
    const feedback: string[] = [];

    // Comprimento (até 40 pontos)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    // Complexidade (até 40 pontos)
    if (/[a-z]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Adicione letras minúsculas');
    }

    if (/[A-Z]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Adicione letras maiúsculas');
    }

    if (/\d/.test(password)) {
      score += 10;
    } else {
      feedback.push('Adicione números');
    }

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Adicione caracteres especiais');
    }

    // Diversidade (até 20 pontos)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= 8) score += 5;
    if (uniqueChars >= 12) score += 5;
    if (uniqueChars >= 16) score += 10;

    // Penalidades
    if (this.isCommonPassword(password)) {
      score -= 50;
      feedback.push('Esta senha é muito comum. Escolha uma senha mais única.');
    }

    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      feedback.push('Evite repetir o mesmo caractere consecutivamente');
    }

    if (/012|123|234|345|456|567|678|789|abc|bcd|cde/.test(password.toLowerCase())) {
      score -= 10;
      feedback.push('Evite sequências óbvias');
    }

    // Garantir que score está entre 0-100
    score = Math.max(0, Math.min(100, score));

    // Determinar nível
    let level: 'weak' | 'medium' | 'strong' | 'very_strong';
    if (score < 40) {
      level = 'weak';
    } else if (score < 60) {
      level = 'medium';
    } else if (score < 80) {
      level = 'strong';
    } else {
      level = 'very_strong';
    }

    return {
      score,
      level,
      feedback,
    };
  }
}
