import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type WeekStart,
  setPreference,
  usePreference,
} from '@/lib/preferences';

import { SettingRow } from './SettingRow';

const DAYS: { value: WeekStart; label: string }[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export function WeekSettings() {
  const startsOn = usePreference('weekStartsOn');

  return (
    <div>
      <SettingRow
        label="Week starts on"
        description="The first column of Week and project calendars."
      >
        <Select
          value={String(startsOn)}
          onValueChange={(value) =>
            setPreference('weekStartsOn', Number(value) as WeekStart)
          }
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAYS.map((day) => (
              <SelectItem key={day.value} value={String(day.value)}>
                {day.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </div>
  );
}
