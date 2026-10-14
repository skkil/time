import { useWindowDimensions } from 'react-native';

export const WIDE_MIN_WIDTH = 768;

/** Wide enough for two panes: tablets and large phones in landscape. */
export const useWide = () => useWindowDimensions().width >= WIDE_MIN_WIDTH;
