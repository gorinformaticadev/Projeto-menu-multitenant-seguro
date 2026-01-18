 import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordHistoryService {
  constructor(private prisma: PrismaService) {
      // Empty implementation
    }

  /**
   * Verificar se a senha jÃ¡ foi usada recentemente
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

    // Buscar configuraÃ§Ã£o de limite de reutilizaÃ§Ã£o
    const securityConfig = await this.prisma.securityConfig.findFirst();
    const reuseLimit = securityConfig?.passwordReuseLimit || 5;

    try {
      const passwordHistory: string[] = JSON.parse(user.passwordHistory);

      // Verificar contra cada senha no histÃ³rico
      for (let i = 0; i < passwordHistory.length; i++) {
        const isMatch = await bcrypt.compare(newPassword, passwordHistory[i]);
        if (isMatch) {
          const _positionInHistory = i + 1;
          return {
            isReused: true,
            message: `Esta senha jÃ¡ foi utilizada recentemente. VocÃª nÃ£o pode reutilizar as Ãºltimas ${reuseLimit} senhas.`,
          };
        }
      }

      return { isReused: false };
    } catch (error) {
      // Se houver erro ao parsear JSON, considerar que nÃ£o hÃ¡ histÃ³rico
      return { isReused: false };
    }
  }

  /**
   * Adicionar nova senha ao histÃ³rico
   */
  async addPasswordToHistory(userId: string, hashedPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return;
    }

    // Buscar configuraÃ§Ã£o de limite
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

    // Adicionar nova senha no inÃ­cio do array
    passwordHistory.unshift(hashedPassword);

    // Manter apenas as Ãºltimas N senhas
    if (passwordHistory.length > reuseLimit) {
      passwordHistory = passwordHistory.slice(0, reuseLimit);
    }

    // Salvar histÃ³rico atualizado
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
      errors.push(`A senha deve ter no mÃ­nimo ${minLength} caracteres`);
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra maiÃºscula');
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra minÃºscula');
    }

    if (requireNumbers && !/\d/.test(password)) {
      errors.push('A senha deve conter pelo menos um nÃºmero');
    }

    if (requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('A senha deve conter pelo menos um caractere especial');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Verificar se senha Ã© comum/fraca
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
   * Gerar sugestÃµes de senha forte
   */
  generatePasswordSuggestions(): string[] {
    const suggestions = [
      'Use pelo menos 12 caracteres',
      'Combine letras maiÃºsculas e minÃºsculas',
      'Inclua nÃºmeros e caracteres especiais',
      'Evite informaÃ§Ãµes pessoais (nome, data de nascimento)',
      'NÃ£o reutilize senhas de outros serviÃ§os',
      'Use um gerenciador de senhas',
      'Considere usar uma frase-senha (passphrase)',
    ];

    return suggestions;
  }

  /**
   * Calcular forÃ§a da senha
   */
  calculatePasswordStrength(password: string): {
    score: number; // 0-100
    level: 'weak' | 'medium' | 'strong' | 'very_strong';
    feedback: string[];
  } {
    let score = 0;
    const feedback: string[] = [];

    // Comprimento (atÃ© 40 pontos)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    // Complexidade (atÃ© 40 pontos)
    if (/[a-z]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Adicione letras minÃºsculas');
    }

    if (/[A-Z]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Adicione letras maiÃºsculas');
    }

    if (/\d/.test(password)) {
      score += 10;
    } else {
      feedback.push('Adicione nÃºmeros');
    }

    if (/[!@#$%^&*()_+\-=[\]{
      // Empty implementation
    };':"\\|,.<>/?]/.test(password)) {
      score += 10;
    } else {
      feedback.push('Adicione caracteres especiais');
    }

    // Diversidade (atÃ© 20 pontos)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= 8) score += 5;
    if (uniqueChars >= 12) score += 5;
    if (uniqueChars >= 16) score += 10;

    // Penalidades
    if (this.isCommonPassword(password)) {
      score -= 50;
      feedback.push('Esta senha Ã© muito comum. Escolha uma senha mais Ãºnica.');
    }

    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      feedback.push('Evite repetir o mesmo caractere consecutivamente');
    }

    if (/012|123|234|345|456|567|678|789|abc|bcd|cde/.test(password.toLowerCase())) {
      score -= 10;
      feedback.push('Evite sequÃªncias Ã³bvias');
    }

    // Garantir que score estÃ¡ entre 0-100
    score = Math.max(0, Math.min(100, score));

    // Determinar nÃ­vel
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

