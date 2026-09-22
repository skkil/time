import { CheckIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { useMemo } from 'react';

import type { Habit, HabitDay } from '@/bindings';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { shiftKey, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import {
  dayLookup,
  useAddHabitValue,
  useHabitDays,
  useHabits,
  useSetHabitStatus,
} from './api';
import { TIMES_OF_DAY, progressLabel } from './meta';

const isCounted = (habit: Habit) =>
  habit.kind !== 'quit' && (habit.unit === 'minutes' || (habit.goal ?? 1) > 1);

export function HabitDots() {
  const today = todayKey();
  const { data: habits = [] } = useHabits();
  const { data: days } = useHabitDays(today, shiftKey(today, 1));
  const lookup = useMemo(() => dayLookup(days), [days]);
  const due = habits
    .map((habit) => ({ habit, day: lookup(habit.id, today) }))
    .filter(({ day }) => day && day.status !== 'off')
    .sort(
      (a, b) =>
        TIMES_OF_DAY.findIndex((t) => t.value === a.habit.timeOfDay) -
        TIMES_OF_DAY.findIndex((t) => t.value === b.habit.timeOfDay),
    );
  if (due.length === 0) return null;
  return (
    <ul aria-label="Habits today" className="mt-3 flex flex-wrap gap-2.5">
      {due.map(({ habit, day }) => (
        <li key={habit.id}>
          <HabitDot habit={habit} day={day!} />
        </li>
      ))}
    </ul>
  );
}

function HabitDot({ habit, day }: { habit: Habit; day: HabitDay }) {
  const setStatus = useSetHabitStatus();
  const addValue = useAddHabitValue();
  const quit = habit.kind === 'quit';
  const status = day.status;
  const value = day.value ?? 0;
  const label = quit
    ? status === 'failed'
      ? `${habit.name}: slipped today`
      : `${habit.name}: clean today`
    : status === 'skipped'
      ? `${habit.name}: rest today`
      : `${habit.name}: ${status === 'done' ? 'done' : progressLabel(habit, value)}`;
  const title = `${label}${habit.dueDays > 0 ? ` · ${habit.doneDays} of last ${habit.dueDays}` : ''}`;
  const filled = quit ? status !== 'failed' : status === 'done';

  const dot = (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={
        isCounted(habit) || habit.tracking
          ? undefined
          : () =>
              setStatus.mutate({
                habitId: habit.id,
                date: day.date,
                status: quit
                  ? status === 'failed'
                    ? null
                    : 'failed'
                  : status === 'done'
                    ? null
                    : 'done',
              })
      }
      className={cn(
        'grid size-4 place-items-center rounded-full transition-all duration-500 hover:scale-125',
        filled
          ? 'bg-white/80 text-[#0b1a22]'
          : status === 'skipped'
            ? 'ring-dashed ring-1 ring-white/20'
            : 'ring-1 ring-white/45',
      )}
    >
      {filled && !quit && <CheckIcon className="size-2.5" strokeWidth={3} />}
    </button>
  );

  if (!isCounted(habit) && !habit.tracking) return dot;
  const step = habit.unit === 'minutes' ? 15 : 1;
  return (
    <Popover>
      <PopoverTrigger asChild>{dot}</PopoverTrigger>
      <PopoverContent align="start" className="w-60">
        <p className="text-sm">{habit.name}</p>
        <p className="mt-0.5 text-xs text-foreground/75">
          {progressLabel(habit, value)}
          {habit.tracking && ' · tracked automatically'}
        </p>
        {!habit.tracking && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              aria-label={`Remove ${step}`}
              disabled={value <= 0}
              onClick={() =>
                addValue.mutate({
                  habitId: habit.id,
                  date: day.date,
                  delta: -step,
                })
              }
              className="grid size-8 place-items-center rounded-full ring-1 ring-white/20 hover:bg-white/10 disabled:opacity-40"
            >
              <MinusIcon className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Add ${step}`}
              onClick={() =>
                addValue.mutate({
                  habitId: habit.id,
                  date: day.date,
                  delta: step,
                })
              }
              className="grid size-8 place-items-center rounded-full ring-1 ring-white/20 hover:bg-white/10"
            >
              <PlusIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setStatus.mutate({
                  habitId: habit.id,
                  date: day.date,
                  status: status === 'done' ? null : 'done',
                })
              }
              className="ml-auto text-xs text-foreground/75 hover:text-foreground hover:underline"
            >
              {status === 'done' ? 'Undo' : 'Mark done'}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
