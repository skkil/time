import { MinusIcon, PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type DateOrder,
  setPreference,
  usePreference,
} from '@/lib/preferences';
import { formatShortcut } from '@/lib/shortcuts';
import {
  ZOOM_LEVELS,
  formatZoom,
  resetZoom,
  zoomIn,
  zoomOut,
} from '@/lib/zoom';

import { SettingRow } from './SettingRow';

const DATE_ORDERS: { value: DateOrder; label: string }[] = [
  { value: 'dayFirst', label: 'Day first (24 Nov)' },
  { value: 'monthFirst', label: 'Month first (Nov 24)' },
];

export function AppearanceSettings() {
  return (
    <div>
      <ZoomSetting />
      <DateOrderSetting />
    </div>
  );
}

function DateOrderSetting() {
  const order = usePreference('dateOrder');
  return (
    <SettingRow label="Date order" description="How dates read across the app.">
      <Select
        value={order}
        onValueChange={(value) =>
          setPreference('dateOrder', value as DateOrder)
        }
      >
        <SelectTrigger size="sm" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_ORDERS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingRow>
  );
}

function ZoomSetting() {
  const zoom = usePreference('zoom');
  return (
    <SettingRow
      label="Zoom"
      device
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
