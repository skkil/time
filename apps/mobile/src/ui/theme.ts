import { type Token, projectColor, tokens } from '@skkil-time/tokens/colors';
import { useColorScheme } from 'react-native';

export type Theme = Record<Token, string> & { scheme: 'light' | 'dark' };

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...tokens(scheme), scheme };
}

export const useProjectColor = () => {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (color: string) => projectColor(color, scheme);
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = { sm: 4, md: 6, lg: 10, pill: 999 } as const;

export const type = {
  title: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16 },
  small: { fontSize: 13 },
};
