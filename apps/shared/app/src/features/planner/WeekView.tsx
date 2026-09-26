import { useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';

import { Page, PageHeader, Stat, WeekSwitcher } from '@/components/page';
import { useTasks } from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import { trackedFill } from '@/features/time/tracked';
import { usePreference } from '@/lib/preferences';
import { useShortcuts } from '@/lib/shortcuts';
import {
  type DateKey,
  formatDuration,
  formatWeekRange,
  reviewWeekOf,
  secondsWithin,
  shiftKey,
  todayKey,
  weekOfMonday,
  weekStartOf,
} from '@/lib/time';

import { ScheduleView } from './ScheduleView';
import { WeekPicker } from './WeekPicker';
import { WeekReflection } from './WeekReflection';
import { useBlocks } from './api';
import { plannedSeconds } from './planned';
import { useWeekSwipe } from './use-week-swipe';

export function WeekView({ week }: { week: DateKey }) {
  const navigate = useNavigate();
  const startsOn = usePreference('weekStartsOn');
  const start = weekStartOf(week, startsOn);
  const reviewWeek = reviewWeekOf(start);
  const past = start < weekStartOf(todayKey(), startsOn);
  const body = useRef<HTMLDivElement>(null);
  const { data: blocks = [] } = useBlocks(start);
  const { data: entries = [] } = useTimeEntries(start, shiftKey(start, 7));
  const { data: tasks = [] } = useTasks();
  const planned = plannedSeconds(blocks, tasks, start, shiftKey(start, 7));
  const tracked = entries.reduce(
    (sum, entry) => sum + secondsWithin(entry, start, shiftKey(start, 7)),
    0,
  );

  const go = (next: DateKey) =>
    navigate({ to: '/', search: { view: 'week', week: next } });
  const step = (by: 1 | -1) => go(shiftKey(start, 7 * by));

  useWeekSwipe(body, start, step);
  useShortcuts([
    { keys: 'Shift+ArrowLeft', run: () => step(-1), idle: true },
    { keys: 'Shift+ArrowRight', run: () => step(1), idle: true },
  ]);

  return (
    <Page>
      <PageHeader
        title={
          <WeekPicker
            week={reviewWeek}
            onPick={(monday) => go(weekOfMonday(monday))}
          />
        }
        meta={[
          formatWeekRange(start),
          <Stat
            value={formatDuration(planned)}
            label="planned"
            swatch={
              <span
                aria-hidden
                className="size-2.5 rounded-[3px] border-l-2 border-foreground/80 bg-foreground/25"
              />
            }
          />,
          <Stat
            value={formatDuration(tracked)}
            label="focused"
            swatch={
              <span
                aria-hidden
                className="size-2.5 rounded-[3px]"
                style={{ background: trackedFill('var(--foreground)') }}
              />
            }
          />,
        ]}
        actions={<WeekSwitcher week={start} onChange={go} />}
      />
      <div ref={body} className="flex min-h-0 flex-1 flex-col">
        <ScheduleView
          week={start}
          aside={
            past ? (
              <WeekReflection key={start} week={reviewWeek} start={start} />
            ) : undefined
          }
        />
      </div>
    </Page>
  );
}
