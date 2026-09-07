import { CheckIcon, GoalIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Id, Outcome } from '@/bindings';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Chip } from '@/features/tasks/fields';
import { type DateKey, mondayOf, shiftKey, todayKey } from '@/lib/time';

import { useWeek } from './api';
import { weekName } from './format';

export function OutcomePicker({
  value,
  onChange,
  weeks = [mondayOf(todayKey()), shiftKey(mondayOf(todayKey()), 7)],
  trigger,
}: {
  value: Id | null;
  onChange: (value: Id | null) => void;
  weeks?: [DateKey, DateKey] | [DateKey];
  trigger?: (selected: Outcome | undefined) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data: first } = useWeek(weeks[0]);
  const { data: second } = useWeek(weeks[1] ?? weeks[0]);
  const groups = [
    { label: weekName(weeks[0]), outcomes: first?.outcomes ?? [] },
    ...(weeks[1]
      ? [{ label: weekName(weeks[1]), outcomes: second?.outcomes ?? [] }]
      : []),
  ];
  const all = groups.flatMap((group) => group.outcomes);
  const selected = all.find((outcome) => outcome.id === value);
  const choosable = (outcome: Outcome) =>
    outcome.status === 'open' || outcome.id === value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger?.(selected) ?? (
          <Chip
            active={value !== null}
            icon={<GoalIcon />}
            onClear={() => onChange(null)}
          >
            {selected?.title ??
              (value !== null ? 'Earlier outcome' : 'Outcome')}
          </Chip>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="start">
        {groups.map(
          (group) =>
            group.outcomes.some(choosable) && (
              <div key={group.label} className="grid">
                <p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
                  {group.label}
                </p>
                {group.outcomes.filter(choosable).map((outcome) => (
                  <button
                    key={outcome.id}
                    type="button"
                    className="flex min-h-8 w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onChange(outcome.id);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1">{outcome.title}</span>
                    {outcome.id === value && <CheckIcon className="size-4" />}
                  </button>
                ))}
              </div>
            ),
        )}
        {!all.some(choosable) && (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            No open outcomes
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
