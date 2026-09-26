import { type Token, dark, light } from '#colors';

const declarations = (values: Partial<Record<Token, string>>) =>
  Object.entries(values)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join('\n');

export const renderCss = () =>
  [
    '/* Generated from src/colors.ts by `pnpm generate`. Do not edit. */',
    `:root {\n${declarations(light)}\n}`,
    `.dark {\n${declarations(dark)}\n}`,
    '',
  ].join('\n\n');
