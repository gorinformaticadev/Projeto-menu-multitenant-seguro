import { Injectable, Logger } from '@nestjs/common';
import * as ts from 'typescript';

/**
 * SAFE CONFIG PARSER - Parser Seguro sem eval()
 * 
 * Usa TypeScript Compiler API para extrair configurações
 * de módulos sem executar código arbitrário
 */

export interface ModuleConfigParsed {
  name: string;
  slug: string;
  version: string;
  enabled: boolean;
  sandboxed: boolean;
  permissionsStrict: boolean;
  author?: string;
  description?: string;
  category?: string;
  allowEval?: boolean;
  allowWindowAccess?: boolean;
  requiresAuth?: boolean;
}

export interface ModulePageParsed {
  id: string;
  path: string;
  component: string;
  protected: boolean;
  permissions: string[];
  title?: string;
  description?: string;
}

@Injectable()
export class SafeConfigParser {
  private readonly logger = new Logger(SafeConfigParser.name);

  /**
   * Extrai configuração do module.config.ts sem executar código
   */
  parseModuleConfig(fileContent: string): ModuleConfigParsed | null {
    try {
      // Criar AST do arquivo
      const sourceFile = ts.createSourceFile(
        'module.config.ts',
        fileContent,
        ts.ScriptTarget.Latest,
        true
      );

      let configObject: any = null;

      // Percorrer AST procurando por "export const moduleConfig"
      const visit = (node: ts.Node) => {
        if (ts.isVariableStatement(node)) {
          const declaration = node.declarationList.declarations[0];
          
          if (
            ts.isVariableDeclaration(declaration) &&
            declaration.name.getText() === 'moduleConfig' &&
            declaration.initializer
          ) {
            // Extrair o objeto literal
            configObject = this.extractObjectLiteral(declaration.initializer);
          }
        }
        
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      if (!configObject) {
        throw new Error('moduleConfig não encontrado');
      }

      // Validar campos obrigatórios
      this.validateRequiredFields(configObject, [
        'name',
        'slug',
        'version',
        'enabled'
      ]);

      // Aplicar defaults
      return {
        sandboxed: true,
        permissionsStrict: true,
        ...configObject
      };

    } catch (error) {
      this.logger.error('Erro ao parsear module.config.ts:', error);
      return null;
    }
  }

  /**
   * Extrai páginas do module.pages.ts sem executar código
   */
  parseModulePages(fileContent: string): ModulePageParsed[] | null {
    try {
      const sourceFile = ts.createSourceFile(
        'module.pages.ts',
        fileContent,
        ts.ScriptTarget.Latest,
        true
      );

      let pagesArray: any[] = null;

      const visit = (node: ts.Node) => {
        if (ts.isVariableStatement(node)) {
          const declaration = node.declarationList.declarations[0];
          
          if (
            ts.isVariableDeclaration(declaration) &&
            declaration.name.getText() === 'modulePages' &&
            declaration.initializer &&
            ts.isArrayLiteralExpression(declaration.initializer)
          ) {
            pagesArray = this.extractArrayLiteral(declaration.initializer);
          }
        }
        
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      if (!pagesArray) {
        throw new Error('modulePages não encontrado');
      }

      // Validar cada página
      pagesArray.forEach((page, index) => {
        this.validateRequiredFields(page, ['id', 'path'], `Página ${index}`);
      });

      return pagesArray;

    } catch (error) {
      this.logger.error('Erro ao parsear module.pages.ts:', error);
      return null;
    }
  }

  /**
   * Extrai objeto literal do AST
   */
  private extractObjectLiteral(node: ts.Node): any {
    if (!ts.isObjectLiteralExpression(node)) {
      return null;
    }

    const obj: any = {};

    node.properties.forEach(prop => {
      if (ts.isPropertyAssignment(prop)) {
        const key = prop.name.getText();
        const value = this.extractValue(prop.initializer);
        obj[key] = value;
      }
    });

    return obj;
  }

  /**
   * Extrai array literal do AST
   */
  private extractArrayLiteral(node: ts.ArrayLiteralExpression): any[] {
    return node.elements.map(element => {
      if (ts.isObjectLiteralExpression(element)) {
        return this.extractObjectLiteral(element);
      }
      return this.extractValue(element);
    });
  }

  /**
   * Extrai valor primitivo do AST
   */
  private extractValue(node: ts.Node): any {
    // String literal
    if (ts.isStringLiteral(node)) {
      return node.text;
    }

    // Numeric literal
    if (ts.isNumericLiteral(node)) {
      return parseFloat(node.text);
    }

    // Boolean
    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    }
    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    }

    // Null
    if (node.kind === ts.SyntaxKind.NullKeyword) {
      return null;
    }

    // Array
    if (ts.isArrayLiteralExpression(node)) {
      return this.extractArrayLiteral(node);
    }

    // Object
    if (ts.isObjectLiteralExpression(node)) {
      return this.extractObjectLiteral(node);
    }

    // Arrow function (para component)
    if (ts.isArrowFunction(node)) {
      return node.getText();
    }

    // Outros casos - retornar como string
    return node.getText();
  }

  /**
   * Valida campos obrigatórios
   */
  private validateRequiredFields(
    obj: any,
    requiredFields: string[],
    context = 'Objeto'
  ): void {
    for (const field of requiredFields) {
      if (!(field in obj) || obj[field] === undefined) {
        throw new Error(
          `${context}: Campo obrigatório '${field}' não encontrado`
        );
      }
    }
  }
}
