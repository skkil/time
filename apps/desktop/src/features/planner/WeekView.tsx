import { useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';

import { Page, PageHeader, Stat, WeekSwitcher } from '@/components/page';
import { useTimeEntries } from '@/features/time/api';
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
  const planned = blocks.reduce(
    (sum, block) => sum + block.endAt - block.startAt,
    0,
  );
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
          <Stat value={formatDuration(planned)} label="planned" />,
          <Stat value={formatDuration(tracked)} label="tracked" />,
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
