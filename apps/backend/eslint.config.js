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
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-var-requires': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
      'no-case-declarations': 'warn',
      'no-control-regex': 'warn',
      'no-empty': 'warn',
      'no-irregular-whitespace': 'warn',
    },
  },
  {
    files: ['src/**/*.spec.ts', 'src/**/*.e2e-spec.ts', 'src/**/*.dynamic-settings.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/core/_deprecated/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['src/main.ts', 'src/reset-admin-password.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
