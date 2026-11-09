import { useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  type SleepWindow,
  setPreference,
  usePreference,
} from '@/lib/preferences';
import { formatMinutesOfDay, parseClockInput } from '@/lib/time';

import { SettingRow } from './SettingRow';

const DEFAULT_SLEEP: SleepWindow = { start: 23 * 60, end: 7 * 60 };

function ClockField({
  label,
  value,
  other,
  onChange,
}: {
  label: string;
  value: number;
  other: number;
  onChange: (minutes: number) => void;
}) {
  const shown = formatMinutesOfDay(value);
  const [text, setText] = useState(shown);

  const commit = () => {
    const minutes = parseClockInput(text);
    if (minutes === null || minutes === other) return setText(shown);
    setText(formatMinutesOfDay(minutes));
    onChange(minutes);
  };

  return (
    <Input
      aria-label={label}
      value={text}
      className="h-8 w-20 text-center"
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && commit()}
    />
  );
}

export function SleepSettings() {
  const sleep = usePreference('sleep');

  return (
    <>
      <SettingRow
        label="Compact sleep hours"
        description="Shrink these hours on Day and Week. Anything in them still shows."
      >
        <Checkbox
          aria-label="Compact sleep hours"
          checked={sleep !== null}
          onCheckedChange={(checked) =>
            setPreference('sleep', checked === true ? DEFAULT_SLEEP : null)
          }
        />
      </SettingRow>
      {sleep && (
        <SettingRow label="Sleep hours">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClockField
              label="Sleep from"
              value={sleep.start}
              other={sleep.end}
              onChange={(start) => setPreference('sleep', { ...sleep, start })}
            />
            to
            <ClockField
              label="Sleep until"
              value={sleep.end}
              other={sleep.start}
              onChange={(end) => setPreference('sleep', { ...sleep, end })}
            />
          </div>
        </SettingRow>
      )}
    </>
  );
}
