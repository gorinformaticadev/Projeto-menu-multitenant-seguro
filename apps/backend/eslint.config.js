const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    files: ['src/**/*.ts'],
    ignores: ['dist/**', 'node_modules/**', '*.js', 'src/modules/ordem_servico/index.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-var-requires': 'warn',
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MethodDefinition[kind="method"] Decorator[expression.callee.name="Res"]',
          message: 'O uso de @Res() é proibido para garantir a blindagem de contrato. Use retorno direto de DTO.',
        },
        {
          selector: 'MethodDefinition[kind="method"] Decorator[expression.callee.name="Response"]',
          message: 'O uso de @Response() é proibido para garantir a blindagem de contrato. Use retorno direto de DTO.',
        },
        {
          selector: 'ClassDeclaration[id.name=/.*Controller$/] MethodDefinition[kind="method"]:not([returnType])',
          message: 'Endpoints de Controller devem ter tipo de retorno explícito (DTO).',
        },
        {
          selector: 'ClassDeclaration[id.name=/.*Controller$/] MethodDefinition[kind="method"] TSAnyKeyword',
          message: 'O tipo "any" é proibido em endpoints de Controller. Use um DTO.',
        },
      ],
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
      'no-case-declarations': 'warn',
      'no-control-regex': 'warn',
      'no-empty': 'warn',
      'no-irregular-whitespace': 'warn',
    },
  },
];
