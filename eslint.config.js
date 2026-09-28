import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/build',
    '**/node_modules',
    '**/.expo',
    'apps/mobile/expo-env.d.ts',
    'apps/desktop/src-tauri',
    'apps/server',
    'apps/shared/contract/src/bindings.ts',
    'apps/shared/api/src/schema.ts',
    'apps/shared/app/src/components/ui',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message:
                'Use an absolute import instead of a parent-relative import (../).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
]);
