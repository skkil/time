import type { ViewStyle } from 'react-native';

import { radius } from '@/ui/theme';

/** The task window, Quick Add and every dialog: desktop's `WINDOW_SURFACE`, denser because React Native has no backdrop blur. */
export const WINDOW: ViewStyle = {
  borderRadius: radius.window,
  backgroundColor: 'rgba(10, 18, 32, 0.97)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.10)',
};

/** Glass held in the flow of a page: settings groups, week days, the focus panel. */
export const HELD: ViewStyle = {
  borderRadius: radius.lg,
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.07)',
};

/** The one filled pill per surface. */
export const PRIMARY_PILL: ViewStyle = {
  height: 44,
  paddingHorizontal: 18,
  borderRadius: radius.pill,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

/** Quiet pills beside it: a hairline ring on the sky. */
export const OUTLINE_PILL: ViewStyle = {
  height: 44,
  paddingHorizontal: 18,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.2)',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};
