import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { findPlace } from '@/features/day/weather';
import { setPreference, usePreference } from '@/lib/preferences';

import { SettingRow } from './SettingRow';

const PARTS = [
  { key: 'showWeekday', label: 'Weekday' },
  { key: 'showDate', label: 'Date' },
  { key: 'showWeather', label: 'Weather' },
] as const;

export function TodaySettings() {
  const name = usePreference('profileName');
  const place = usePreference('weatherPlace');
  const weekday = usePreference('showWeekday');
  const date = usePreference('showDate');
  const weather = usePreference('showWeather');
  const shown = { showWeekday: weekday, showDate: date, showWeather: weather };
  const [query, setQuery] = useState(place?.name ?? '');
  const [status, setStatus] = useState('');

  const lookUp = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) {
      setPreference('weatherPlace', null);
      return setStatus('');
    }
    setStatus('Looking…');
    const found = await findPlace(query.trim()).catch(() => null);
    if (!found) return setStatus('Couldn’t find that place.');
    setPreference('weatherPlace', found);
    setQuery(found.name);
    setStatus('');
  };

  return (
    <div>
      <SettingRow label="Your name" description="Shown on the profile circle.">
        <Input
          className="h-8 w-48"
          value={name}
          maxLength={40}
          onChange={(event) => setPreference('profileName', event.target.value)}
        />
      </SettingRow>
      <SettingRow label="Show at the top of Day">
        <div className="flex gap-4">
          {PARTS.map((part) => (
            <label key={part.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={shown[part.key]}
                onCheckedChange={(checked) =>
                  setPreference(part.key, checked === true)
                }
              />
              {part.label}
            </label>
          ))}
        </div>
      </SettingRow>
      <SettingRow
        label="Weather for"
        description={
          status ||
          'A city name. Weather comes from Open-Meteo; only the city’s coordinates are sent.'
        }
      >
        <form onSubmit={lookUp} className="flex gap-2">
          <Input
            className="h-8 w-40"
            value={query}
            placeholder="Seoul"
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" size="sm" variant="outline">
            Set
          </Button>
        </form>
      </SettingRow>
    </div>
  );
}
