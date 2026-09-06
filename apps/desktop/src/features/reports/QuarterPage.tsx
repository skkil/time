import { Link } from '@tanstack/react-router';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { useQuarter, useWeeks } from '@/features/review/api';
import { QUARTER_WEEKS, quarterLabel } from '@/features/review/format';
import {
  type DateKey,
  formatHours,
  formatWeekRange,
  isoWeekNumber,
  mondayOf,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { ReportSection } from './ReportsPage';
import { calendarQuarterStart } from './period';

export function QuarterPage({ week }: { week: DateKey }) {
  const { data: quarter, isPending } = useQuarter(week);
  const start = quarter?.startDate ?? calendarQuarterStart(week);
  const end = shiftKey(start, QUARTER_WEEKS * 7);
  const { data: summaries = [] } = useWeeks(start, end);
  const thisMonday = mondayOf(todayKey());
  const current = thisMonday >= start && thisMonday < end;
  const hours = summaries.map((summary) => summary.trackedSeconds);
  const max = Math.max(3600, ...hours);
  if (isPending) return null;

  return (
    <article className="mt-8 grid gap-12">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm text-foreground/45">
            {formatWeekRange(start).split(' – ')[0]} –{' '}
            {formatWeekRange(shiftKey(end, -7)).split(' – ').at(-1)}
          </p>
          <h1 className="mt-1 text-5xl font-light tracking-tight">
            {quarter?.label ?? quarterLabel(week)}
          </h1>
          {current && quarter && (
            <p className="mt-3 text-sm text-foreground/55">
              Week {quarter.weekNo} of {QUARTER_WEEKS}
            </p>
          )}
        </div>
        <nav className="flex gap-1">
          <Link
            to="/reports/quarter/$week"
            params={{ week: shiftKey(start, -7) }}
            aria-label="Previous quarter"
            className="grid size-9 place-items-center rounded-full text-foreground/55 hover:bg-white/10 hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" />
          </Link>
          <Link
            to="/reports/quarter/$week"
            params={{ week: end }}
            aria-label="Next quarter"
            className="grid size-9 place-items-center rounded-full text-foreground/55 hover:bg-white/10 hover:text-foreground"
          >
            <ChevronRightIcon className="size-4" />
          </Link>
        </nav>
      </header>

      {quarter && quarter.priorities.length > 0 && (
        <ReportSection title="Priorities">
          <ul className="grid gap-4">
            {quarter.priorities.map((priority) => (
              <li key={priority.id}>
                <p className="text-[17px]">{priority.title}</p>
                <p className="text-sm text-foreground/45">
                  {priority.achieved === 1
                    ? '1 outcome achieved'
                    : `${priority.achieved} outcomes achieved`}
                </p>
                {priority.note && (
                  <p className="mt-1 text-[15px] text-foreground/75">
                    {priority.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}
      {!quarter && (
        <p className="text-foreground/55">
          No quarter was planned for these weeks. Plan one from the quarter line
          in Week.
        </p>
      )}

      <ReportSection title="Weeks">
        <ol className="grid grid-cols-13 gap-1.5">
          {Array.from({ length: QUARTER_WEEKS }, (_, i) => {
            const monday = shiftKey(start, i * 7);
            const summary = summaries.find((item) => item.startDate === monday);
            const future = monday > thisMonday;
            const tracked = summary?.trackedSeconds ?? 0;
            return (
              <li key={monday}>
                <Link
                  to="/reports/week/$week"
                  params={{ week: monday }}
                  disabled={future}
                  aria-label={`Week ${isoWeekNumber(monday)}, ${formatHours(tracked)} hours`}
                  className={cn(
                    'group grid gap-1.5 rounded-xl px-1 py-2 text-center hover:bg-white/[.05]',
                    future && 'pointer-events-none opacity-35',
                    monday === thisMonday && 'bg-white/[.06]',
                  )}
                >
                  <span className="relative mx-auto flex h-24 w-2 items-end overflow-hidden rounded-full bg-white/[.06]">
                    <span
                      className="w-full rounded-full bg-white/70"
                      style={{ height: `${(tracked / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-[11px] text-foreground/60 tabular-nums">
                    {formatHours(tracked)}h
                  </span>
                  <span className="text-[11px] text-foreground/45 tabular-nums">
                    {summary?.outcomesTotal
                      ? `${summary.outcomesAchieved}/${summary.outcomesTotal}`
                      : '–'}
                  </span>
                  <span className="flex h-3 justify-center text-foreground/55">
                    {summary?.reviewedAt != null && (
                      <CheckIcon className="size-3" aria-label="Reviewed" />
                    )}
                  </span>
                  <span className="text-[10px] text-foreground/35">
                    {i + 1}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </ReportSection>
    </article>
  );
}
