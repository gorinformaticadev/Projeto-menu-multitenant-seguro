import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
      '@typescript-eslint': tseslint
    },
    rules: {
      /* React */
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'warn',

      /* React Hooks */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      /* Next.js */
      '@next/next/no-img-element': 'warn',
      '@next/next/no-assign-module-variable': 'warn',

      /* TypeScript */
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  }
];
