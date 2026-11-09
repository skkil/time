import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * The ESLint setup every TypeScript package shares. `ignores` adds the
 * package's generated files; `components` turns off the fast-refresh rule for
 * apps whose files export components alongside other values (Expo Router).
 */
export function config({ ignores = [], components = true } = {}) {
  return defineConfig([
    globalIgnores(['dist', 'build', 'node_modules', '.expo', ...ignores]),
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
        ...(components
          ? {}
          : { 'react-refresh/only-export-components': 'off' }),
      },
    },
  ]);
}
