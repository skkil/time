import { MinusIcon, PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePreference } from '@/lib/preferences';
import { formatShortcut } from '@/lib/shortcuts';
import {
  ZOOM_LEVELS,
  formatZoom,
  resetZoom,
  zoomIn,
  zoomOut,
} from '@/lib/zoom';

import { SettingRow } from './SettingRow';

export function AppearanceSettings() {
  const zoom = usePreference('zoom');
  return (
    <SettingRow
      label="Zoom"
      description={`${formatShortcut('Mod++')} and ${formatShortcut('Mod+-')} to change, ${formatShortcut('Mod+0')} to reset.`}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom out"
          disabled={zoom <= ZOOM_LEVELS[0]}
          onClick={zoomOut}
        >
          <MinusIcon />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-14 tabular-nums"
          aria-label="Reset zoom"
          disabled={zoom === 1}
          onClick={resetZoom}
        >
          {formatZoom(zoom)}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={zoom >= ZOOM_LEVELS.at(-1)!}
          onClick={zoomIn}
        >
          <PlusIcon />
        </Button>
      </div>
    </SettingRow>
  );
}
