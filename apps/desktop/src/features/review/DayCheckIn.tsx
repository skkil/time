import { useState } from 'react';

import type { Day } from '@/bindings';
import { FeltScale } from '@/components/FeltScale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBlocks } from '@/features/planner/api';
import { useTasks } from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import { useNow } from '@/hooks/use-now';
import {
  type DateKey,
  HOUR,
  dateKeyOf,
  dayStart,
  formatDuration,
  mondayOf,
  shiftKey,
  todayKey,
} from '@/lib/time';

import { useDays, useRateDay, useSaveDayNote, useSkipDay } from './api';

const EVENING_HOUR = 17;
const YESTERDAY_UNTIL_HOUR = 12;

function useCheckInDay(days: Day[] | undefined): DateKey | null {
  const now = useNow(60_000);
  const today = todayKey();
  const yesterday = shiftKey(today, -1);
  const { data: blocks = [] } = useBlocks(mondayOf(today));
  if (!days) return null;

  const find = (date: DateKey) => days.find((item) => item.date === date);
  const hour = (now - dayStart(today)) / HOUR;
  const lastBlockEnd = Math.max(
    0,
    ...blocks
      .filter((block) => dateKeyOf(block.startAt) === today)
      .map((block) => block.endAt),
  );
  const dayIsOver =
    hour >= EVENING_HOUR || (lastBlockEnd > 0 && now >= lastBlockEnd);

  if (dayIsOver && !find(today)?.skipped) return today;
  const last = find(yesterday);
  if (hour < YESTERDAY_UNTIL_HOUR && !last?.skipped && last?.felt == null)
    return yesterday;
  return null;
}

export function DayCheckIn() {
  const { data: days } = useDays(
    shiftKey(todayKey(), -1),
    shiftKey(todayKey(), 1),
  );
  const due = useCheckInDay(days);
  const [pinned, setPinned] = useState<DateKey | null>(null);
  const date = pinned ?? due;
  if (!date) return null;
  return (
    <CheckInRow
      key={date}
      date={date}
      day={days?.find((item) => item.date === date)}
      onRated={() => setPinned(date)}
    />
  );
}

function CheckInRow({
  date,
  day,
  onRated,
}: {
  date: DateKey;
  day?: Day;
  onRated: () => void;
}) {
  const rate = useRateDay();
  const skip = useSkipDay();
  const isToday = date === todayKey();
  const felt = day?.felt ?? null;

  return (
    <section
      aria-label={isToday ? 'Today check-in' : 'Yesterday check-in'}
      className="grid gap-4 rounded-lg border bg-card px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 className="text-sm font-medium">
          How did {isToday ? 'today' : 'yesterday'} feel?
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <FeltScale
            size="sm"
            value={felt}
            label={`How ${isToday ? 'today' : 'yesterday'} felt`}
            onChange={(value) => {
              onRated();
              rate.mutate({ date, felt: value });
            }}
          />
          {felt === null && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => skip.mutate(date)}
            >
              Skip
            </Button>
          )}
        </div>
      </div>
      {felt !== null && <DayFacts date={date} note={day?.note ?? ''} />}
    </section>
  );
}

function DayFacts({ date, note: savedNote }: { date: DateKey; note: string }) {
  const next = shiftKey(date, 1);
  const { data: blocks = [] } = useBlocks(mondayOf(date));
  const { data: entries = [] } = useTimeEntries(date, next);
  const { data: tasks = [] } = useTasks();
  const saveNote = useSaveDayNote();
  const [note, setNote] = useState(savedNote);
  const [saved, setSaved] = useState(savedNote);

  const planned = blocks
    .filter((block) => dateKeyOf(block.startAt) === date)
    .reduce((sum, block) => sum + block.endAt - block.startAt, 0);
  const tracked = entries.reduce(
    (sum, entry) => sum + entry.endedAt - entry.startedAt,
    0,
  );
  const done = tasks.filter(
    (task) => task.completedAt !== null && dateKeyOf(task.completedAt) === date,
  ).length;

  const commit = () => {
    if (note !== saved)
      saveNote.mutate({ date, note }, { onSuccess: () => setSaved(note) });
  };

  return (
    <div className="grid gap-3">
      <p className="flex gap-5 text-sm text-muted-foreground">
        <span>
          <span className="text-foreground">{done}</span> tasks done
        </span>
        <span>
          <span className="text-foreground">{formatDuration(planned)}</span>{' '}
          planned
        </span>
        <span>
          <span className="text-foreground">{formatDuration(tracked)}</span>{' '}
          tracked
        </span>
      </p>
      <div className="flex items-center gap-3">
        <Input
          value={note}
          maxLength={280}
          aria-label="One line about the day"
          placeholder="One line about the day (optional)"
          onChange={(event) => setNote(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
        <span
          className="w-12 shrink-0 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {saveNote.isPending
            ? 'Saving…'
            : note && note === saved
              ? 'Saved'
              : ''}
        </span>
      </div>
    </div>
  );
}
