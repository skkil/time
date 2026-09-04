import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

import type { Ritual, RitualInput } from '@/bindings';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WEEKDAY_LETTERS } from '@/features/habits/meta';
import {
  useChoosePlanningTime,
  usePlanningTime,
  useRituals,
  useUpdateRitual,
} from '@/features/rituals/api';
import {
  RITUALS,
  type RitualKind,
  STEPS,
  type StepKey,
} from '@/features/rituals/meta';
import { ZEN_THEMES } from '@/features/zen/themes';
import {
  type ZenBackdropMode,
  setPreference,
  usePreference,
} from '@/lib/preferences';
import { cn } from '@/lib/utils';

import { SettingRow } from './SettingRow';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const BACKDROPS: { value: ZenBackdropMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'shader', label: 'Animated' },
  { value: 'static', label: 'Still' },
  { value: 'off', label: 'Off' },
];

const inputOf = (ritual: Ritual): RitualInput => ({
  enabled: ritual.enabled,
  trigger: ritual.trigger,
  atMinute: ritual.atMinute,
  weekdays: ritual.weekdays,
  steps: ritual.steps,
});

const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function RitualSettings() {
  const { data: rituals } = useRituals();
  const { data: planning } = usePlanningTime();
  const choose = useChoosePlanningTime();
  const update = useUpdateRitual();
  const backdrop = usePreference('zenBackdrop');
  const theme = usePreference('zenTheme');
  const weekly = rituals?.find((ritual) => ritual.kind === 'weekly');

  return (
    <div className="grid gap-6">
      <div>
        <SettingRow
          label="Plan your day"
          description="Turns on the matching planning ritual."
        >
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={planning ?? ''}
            onValueChange={(value) =>
              (value === 'morning' || value === 'evening') &&
              choose.mutate(value)
            }
          >
            <ToggleGroupItem value="morning" className="px-3">
              Morning
            </ToggleGroupItem>
            <ToggleGroupItem value="evening" className="px-3">
              Evening
            </ToggleGroupItem>
          </ToggleGroup>
        </SettingRow>
        {weekly && (
          <SettingRow
            label="Weekly review day"
            description="It opens the first time you use the app that day."
          >
            <Select
              value={String(Math.log2(weekly.weekdays) | 0)}
              onValueChange={(value) =>
                update.mutate({
                  kind: 'weekly',
                  input: { ...inputOf(weekly), weekdays: 1 << Number(value) },
                })
              }
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((day, i) => (
                  <SelectItem key={day} value={String(i)}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        )}
        <SettingRow
          label="Zen backdrop"
          description="Behind every ritual. Auto animates, and goes still if it stutters."
        >
          <div className="flex gap-2">
            <Select
              value={theme}
              onValueChange={(value) => setPreference('zenTheme', value)}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZEN_THEMES.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={backdrop}
              onValueChange={(value) =>
                setPreference('zenBackdrop', value as ZenBackdropMode)
              }
            >
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BACKDROPS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SettingRow>
      </div>

      {rituals
        ?.filter((ritual) => ritual.kind !== 'weekly')
        .map((ritual) => (
          <RitualCard
            key={ritual.kind}
            ritual={ritual}
            onChange={(input) => update.mutate({ kind: ritual.kind, input })}
          />
        ))}
    </div>
  );
}

function RitualCard({
  ritual,
  onChange,
}: {
  ritual: Ritual;
  onChange: (input: RitualInput) => void;
}) {
  const meta = RITUALS[ritual.kind as RitualKind];
  const input = inputOf(ritual);
  const set = (patch: Partial<RitualInput>) => onChange({ ...input, ...patch });
  const included = ritual.steps as StepKey[];
  const available = (Object.keys(STEPS) as StepKey[]).filter(
    (step) => !included.includes(step),
  );
  const timed = ritual.trigger === 'at_time' || ritual.trigger === 'end_of_day';
  const move = (index: number, by: number) => {
    const steps = [...included];
    const [step] = steps.splice(index, 1);
    steps.splice(index + by, 0, step);
    set({ steps });
  };

  return (
    <section
      aria-label={meta.label}
      className={cn(
        'grid gap-3 rounded-lg border p-4',
        !ritual.enabled && 'opacity-70',
      )}
    >
      <label className="flex items-start gap-3">
        <Checkbox
          checked={ritual.enabled}
          onCheckedChange={(checked) => set({ enabled: checked === true })}
          className="mt-0.5"
        />
        <span className="grid gap-0.5">
          <span className="text-sm font-semibold">
            {meta.label}{' '}
            <span className="font-normal text-muted-foreground">
              · {meta.minutes}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {meta.description}
          </span>
        </span>
      </label>

      {ritual.enabled && (
        <>
          {timed && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                {ritual.trigger === 'end_of_day'
                  ? 'At, or after your last block'
                  : 'At'}
              </span>
              <Input
                type="time"
                className="h-8 w-28"
                value={toTime(ritual.atMinute)}
                onChange={(event) => {
                  const [h, m] = event.target.value.split(':').map(Number);
                  if (!Number.isNaN(h) && !Number.isNaN(m))
                    set({ atMinute: h * 60 + m });
                }}
              />
              <div className="flex gap-1" aria-label="Days">
                {WEEKDAY_LETTERS.map((letter, i) => {
                  const on = (ritual.weekdays & (1 << i)) !== 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      aria-label={WEEKDAYS[i]}
                      onClick={() => {
                        const next = ritual.weekdays ^ (1 << i);
                        if (next !== 0) set({ weekdays: next });
                      }}
                      className={cn(
                        'grid size-7 place-items-center rounded-md border text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        on
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {ritual.trigger === 'after_timer_stop' && (
            <p className="text-xs text-muted-foreground">
              Opens after you stop a timer that ran {ritual.minMinutes} minutes
              or more.
            </p>
          )}
          {ritual.trigger === 'first_open' && (
            <p className="text-xs text-muted-foreground">
              Opens the first time you use the app each day.
            </p>
          )}
          <ol className="grid gap-1">
            {included.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-sm"
              >
                <Checkbox
                  checked
                  disabled={included.length === 1}
                  aria-label={`Remove ${STEPS[step as keyof typeof STEPS].label}`}
                  onCheckedChange={() =>
                    set({ steps: included.filter((other) => other !== step) })
                  }
                />
                <span className="flex-1">
                  {STEPS[step as keyof typeof STEPS].label}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {STEPS[step as keyof typeof STEPS].hint}
                  </span>
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Move down"
                  disabled={index === included.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
              </li>
            ))}
          </ol>
          {available.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Add a step
              </summary>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {available.map((step) => (
                  <li key={step}>
                    <Button
                      size="xs"
                      variant="outline"
                      title={STEPS[step as keyof typeof STEPS].hint}
                      onClick={() => set({ steps: [...included, step] })}
                    >
                      {STEPS[step as keyof typeof STEPS].label}
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
