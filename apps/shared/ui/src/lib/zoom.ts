import {
  getPreference,
  setPreference,
  subscribePreferences,
} from '@/lib/preferences';
import type { Shortcut } from '@/lib/shortcuts';
import { platform } from '@/platform';

export const ZOOM_LEVELS = [
  0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2,
];

export function stepZoom(current: number, direction: 1 | -1) {
  const next =
    direction > 0
      ? ZOOM_LEVELS.find((level) => level > current + 0.001)
      : ZOOM_LEVELS.findLast((level) => level < current - 0.001);
  return next ?? current;
}

export const formatZoom = (zoom: number) => `${Math.round(zoom * 100)}%`;

export const zoomIn = () =>
  setPreference('zoom', stepZoom(getPreference('zoom'), 1));
export const zoomOut = () =>
  setPreference('zoom', stepZoom(getPreference('zoom'), -1));
export const resetZoom = () => setPreference('zoom', 1);

export const zoomShortcuts: Shortcut[] = [
  { keys: ['Mod+=', 'Mod++'], run: zoomIn },
  { keys: ['Mod+-', 'Mod+_'], run: zoomOut },
  { keys: 'Mod+0', run: resetZoom },
];

export function syncZoom() {
  const apply = () => platform().setZoom(getPreference('zoom'));
  apply();
  return subscribePreferences(apply);
}
