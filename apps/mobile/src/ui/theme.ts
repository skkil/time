import { type Token, projectColor, tokens } from '@skkil-time/tokens/colors';
import type { TextStyle } from 'react-native';

export type Theme = Record<Token, string> & { scheme: 'dark' };

const DARK: Theme = { ...tokens('dark'), scheme: 'dark' };

/** The app is dark only, like desktop and web: everything sits on the sky. */
export const useTheme = (): Theme => DARK;

export const useProjectColor = () => (color: string) =>
  projectColor(color, 'dark');

export const ink = {
  full: '#f1f1ee',
  secondary: 'rgba(241, 241, 238, 0.75)',
  faint: 'rgba(241, 241, 238, 0.4)',
  hairline: 'rgba(255, 255, 255, 0.12)',
  onPrimary: '#0b1a22',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = { sm: 6, md: 12, lg: 16, window: 28, pill: 999 } as const;

export const font = {
  extraLight: 'HankenGrotesk_200ExtraLight',
  light: 'HankenGrotesk_300Light',
  regular: 'HankenGrotesk_400Regular',
  medium: 'HankenGrotesk_500Medium',
  semiBold: 'HankenGrotesk_600SemiBold',
} as const;

const numbers: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  display: {
    fontFamily: font.light,
    fontSize: 44,
    letterSpacing: -0.8,
    color: ink.full,
  },
  title: {
    fontFamily: font.light,
    fontSize: 30,
    letterSpacing: -0.4,
    color: ink.full,
  },
  heading: { fontFamily: font.medium, fontSize: 17, color: ink.full },
  body: { fontFamily: font.regular, fontSize: 15, color: ink.full, ...numbers },
  small: {
    fontFamily: font.regular,
    fontSize: 13,
    color: ink.secondary,
    ...numbers,
  },
  tiny: {
    fontFamily: font.regular,
    fontSize: 11,
    color: ink.secondary,
    ...numbers,
  },
  label: { fontFamily: font.medium, fontSize: 14, ...numbers },
} satisfies Record<string, TextStyle>;
