import { waterShader } from './water.frag';

export type ZenTheme = {
  id: string;
  label: string;
  staticBackground: string;
  shader?: string;
};

export const ZEN_THEMES: ZenTheme[] = [
  {
    id: 'water',
    label: 'Still water',
    staticBackground: [
      'radial-gradient(120% 70% at 25% 0%, var(--zen-sky) 0%, transparent 60%)',
      'radial-gradient(90% 60% at 85% 35%, color-mix(in oklab, var(--zen-shallow) 70%, transparent) 0%, transparent 65%)',
      'radial-gradient(140% 80% at 40% 110%, var(--zen-deep) 0%, transparent 70%)',
      'linear-gradient(180deg, var(--zen-sky) 0%, var(--zen-shallow) 38%, var(--zen-mid) 72%, var(--zen-deep) 100%)',
    ].join(', '),
    shader: waterShader,
  },
];

export const zenTheme = (id: string) =>
  ZEN_THEMES.find((theme) => theme.id === id) ?? ZEN_THEMES[0];
