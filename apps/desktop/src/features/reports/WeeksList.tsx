import { Link } from '@tanstack/react-router';
import { Fragment, useMemo } from 'react';

import type { WeekSummary } from '@/bindings';
import { useWeeks } from '@/features/review/api';
import { quarterLabel } from '@/features/review/format';
import { FELT_LABELS } from '@/lib/felt';
import {
  formatHours,
  formatWeekRange,
  isoWeekNumber,
  mondayOf,
  shiftKey,
  todayKey,
} from '@/lib/time';

import { isQuiet } from './period';

type Item =
  | { kind: 'week'; summary: WeekSummary }
  | { kind: 'quiet'; count: number; key: string };

export function WeeksList() {
  const thisMonday = mondayOf(todayKey());
  const { data: summaries } = useWeeks(
    shiftKey(thisMonday, -7 * 104),
    thisMonday,
  );

  const groups = useMemo(() => {
    const all = summaries ?? [];
    const oldestActive = all.findLastIndex((summary) => !isQuiet(summary));
    const result: { label: string; week: string; items: Item[] }[] = [];
    for (const summary of all.slice(0, oldestActive + 1)) {
      const label = quarterLabel(summary.startDate);
      let group = result.at(-1);
      if (group?.label !== label) {
        group = { label, week: summary.startDate, items: [] };
        result.push(group);
      }
      const last = group.items.at(-1);
      if (!isQuiet(summary)) group.items.push({ kind: 'week', summary });
      else if (last?.kind === 'quiet') last.count += 1;
      else
        group.items.push({ kind: 'quiet', count: 1, key: summary.startDate });
    }
    return result;
  }, [summaries]);

  return (
    <div className="mt-8">
      <h1 className="text-4xl font-light tracking-tight">Your weeks</h1>
      <p className="mt-2 text-sm text-foreground/50">
        This week is in{' '}
        <Link
          to="/"
          search={{ view: 'week', week: thisMonday }}
          className="text-foreground/80 hover:underline"
        >
          Week
        </Link>
        .
      </p>
      <div className="mt-10 grid gap-10">
        {groups.map((group) => (
          <section key={group.label + group.week} className="grid gap-1">
            <Link
              to="/reports/quarter/$week"
              params={{ week: group.week }}
              className="mb-2 w-fit text-xs tracking-wide text-foreground/45 hover:text-foreground hover:underline"
            >
              {group.label}
            </Link>
            {group.items.map((item) => (
              <Fragment
                key={item.kind === 'week' ? item.summary.startDate : item.key}
              >
                {item.kind === 'week' ? (
                  <WeekRow summary={item.summary} />
                ) : (
                  <p className="py-2 pl-1 text-sm text-foreground/30">
                    {item.count === 1
                      ? '1 quiet week'
                      : `${item.count} quiet weeks`}
                  </p>
                )}
              </Fragment>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function WeekRow({ summary }: { summary: WeekSummary }) {
  return (
    <Link
      to="/reports/week/$week"
      params={{ week: summary.startDate }}
      className="-mx-3 grid grid-cols-[88px_1fr_auto] items-baseline gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-white/[.05]"
    >
      <span className="text-lg font-light">
        Week {isoWeekNumber(summary.startDate)}
      </span>
      <span className="truncate text-sm text-foreground/55">
        {[
          formatWeekRange(summary.startDate),
          summary.felt && FELT_LABELS[summary.felt - 1],
          summary.outcomesTotal > 0 &&
            `${summary.outcomesAchieved} of ${summary.outcomesTotal} outcomes`,
          `${formatHours(summary.trackedSeconds)} h`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
      <span className="text-xs text-foreground/40">
        {summary.reviewedAt !== null ? 'Reviewed' : 'Not reviewed'}
      </span>
    </Link>
  );
}
