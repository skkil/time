import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

import type { Ritual, RitualInput } from '@/bindings';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRituals, useUpdateRitual } from '@/features/rituals/api';
import {
  RITUALS,
  type RitualKind,
  STEPS,
  type StepKey,
} from '@/features/rituals/meta';
import {
  type ZenBackdropMode,
  setPreference,
  usePreference,
} from '@/lib/preferences';

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
  { value: 'motion', label: 'Moving' },
  { value: 'still', label: 'Still' },
];

const inputOf = (ritual: Ritual): RitualInput => ({
  enabled: ritual.enabled,
  trigger: ritual.trigger,
  atMinute: ritual.atMinute,
  weekdays: ritual.weekdays,
  steps: ritual.steps,
});

export function RitualSettings() {
  const { data: rituals } = useRituals();
  const update = useUpdateRitual();
  const backdrop = usePreference('zenBackdrop');
  const weekly = rituals?.find((ritual) => ritual.kind === 'weekly');

  return (
    <div className="grid gap-6">
      <div>
        {weekly && (
          <SettingRow
            label="Weekly review day"
            description="On this day, Check out offers last week’s review."
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
          label="Background"
          description="A sky that follows the time of day. Still stops the drift."
        >
          <div className="flex gap-2">
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
        ?.filter((ritual) => ritual.kind === 'evening')
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
  const move = (index: number, by: number) => {
    const steps = [...included];
    const [step] = steps.splice(index, 1);
    steps.splice(index + by, 0, step);
    set({ steps });
  };

  return (
    <section aria-label={meta.label} className="grid gap-3">
      <div className="grid gap-0.5">
        <span className="text-sm font-semibold">Check out steps</span>
        <span className="text-xs text-muted-foreground">
          What Check out walks you through, in order.
        </span>
      </div>

      <>
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
    </section>
  );
}
