import { fileURLToPath } from 'node:url';

const own = (specifier) => fileURLToPath(import.meta.resolve(specifier));

/** @type {import('prettier').Config} */
export default {
  printWidth: 80,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  importOrder: ['<THIRD_PARTY_MODULES>', '^@[./]', '^[./]', '^.(css|scss)$'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  plugins: [
    own('@trivago/prettier-plugin-sort-imports'),
    own('prettier-plugin-tailwindcss'),
  ],
  tailwindStylesheet: fileURLToPath(
    new URL('../ui/src/styles/globals.css', import.meta.url),
  ),
};
