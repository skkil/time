import { Link } from '@tanstack/react-router';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';

import type { WeekSummary } from '@/bindings';
import { Page, PageBody, PageHeader, SectionTitle } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import { FELT_LABELS } from '@/lib/felt';
import {
  type DateKey,
  dateKeyOf,
  formatDayLabel,
  formatWeekRange,
  fromDateKey,
  isoWeekNumber,
  mondayOf,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { OutcomePlanner } from './OutcomePlanner';
import { QuarterPanel } from './QuarterPanel';
import { useQuarter, useWeek, useWeeks } from './api';

const HISTORY_WEEKS = 12;
const STEP_NAMES = [
  'Feel',
  'Outcomes',
  'The week',
  'Reflect',
  'Plan',
  'Quarter',
];

export function ReviewHome() {
  const thisWeek = mondayOf(todayKey());
  const { data: quarter = null } = useQuarter(thisWeek);
  return (
    <Page>
      <PageHeader
        title="Review"
        meta={
          quarter
            ? `${quarter.label} · Week ${quarter.weekNo}`
            : `Week ${isoWeekNumber(thisWeek)}`
        }
      />
      <PageBody>
        <div className="mx-auto grid max-w-3xl gap-10">
          <ReviewPrompt week={shiftKey(thisWeek, -7)} />
          <section aria-labelledby="this-week-title">
            <SectionTitle aside={<ThisWeekAside week={thisWeek} />}>
              <span id="this-week-title">
                This week
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {formatWeekRange(thisWeek)}
                </span>
              </span>
            </SectionTitle>
            <OutcomePlanner week={thisWeek} quarter={quarter} showTasks />
          </section>
          <QuarterPanel week={thisWeek} />
          <PastWeeks week={thisWeek} />
        </div>
      </PageBody>
    </Page>
  );
}

function useWasActive(week: DateKey) {
  const end = shiftKey(week, 7);
  const { data } = useWeek(week);
  const { data: entries = [] } = useTimeEntries(week, end);
  const { data: tasks = [] } = useTasks();
  return (
    (data?.outcomes.length ?? 0) > 0 ||
    entries.length > 0 ||
    tasks.some(
      (task) =>
        task.completedAt !== null &&
        dateKeyOf(task.completedAt) >= week &&
        dateKeyOf(task.completedAt) < end,
    )
  );
}

function ReviewPrompt({ week }: { week: DateKey }) {
  const { data } = useWeek(week);
  const active = useWasActive(week);
  if (!data || data.reviewedAt !== null || !active) return null;
  const started = data.step > 0;
  return (
    <section className="flex items-center gap-6 rounded-lg border border-now/40 bg-now-tint px-6 py-5">
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-lg font-bold">
          Week {isoWeekNumber(week)} is ready to review
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {started
            ? `You stopped at ${STEP_NAMES[Math.min(data.step, STEP_NAMES.length - 1)]}.`
            : 'About 5 minutes: how it felt, your outcomes, then next week’s plan.'}
        </p>
      </div>
      <Button asChild>
        <Link to="/review/$week" params={{ week }}>
          {started ? 'Resume review' : 'Start review'}
          <ArrowRightIcon />
        </Link>
      </Button>
    </section>
  );
}

function ThisWeekAside({ week }: { week: DateKey }) {
  const { data } = useWeek(week);
  const weekday = fromDateKey(todayKey()).getDay();
  const late = weekday === 0 || weekday >= 5;
  if (data?.reviewedAt != null)
    return (
      <Link to="/review/$week" params={{ week }} className="hover:underline">
        Reviewed
      </Link>
    );
  if (late)
    return (
      <Button size="xs" variant="outline" asChild>
        <Link to="/review/$week" params={{ week }}>
          Review this week
        </Link>
      </Button>
    );
  return <span>Next review {formatDayLabel(shiftKey(week, 7))}</span>;
}

function PastWeeks({ week }: { week: DateKey }) {
  const { data: weeks = [] } = useWeeks(
    shiftKey(week, -HISTORY_WEEKS * 7),
    week,
  );
  if (weeks.length === 0) return null;
  return (
    <section aria-labelledby="past-title">
      <SectionTitle>
        <span id="past-title">Past weeks</span>
      </SectionTitle>
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {weeks.map((summary) => (
          <PastWeekRow key={summary.startDate} summary={summary} />
        ))}
      </ul>
    </section>
  );
}

function PastWeekRow({ summary }: { summary: WeekSummary }) {
  const reviewed = summary.reviewedAt !== null;
  return (
    <li>
      <Link
        to="/review/$week"
        params={{ week: summary.startDate }}
        className="flex items-center gap-4 px-4 py-2.5 text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        <span className="w-16 font-medium">
          Week {isoWeekNumber(summary.startDate)}
        </span>
        <span className="flex-1 text-muted-foreground">
          {formatWeekRange(summary.startDate)}
        </span>
        <span className="w-14 text-muted-foreground">
          {summary.felt ? FELT_LABELS[summary.felt - 1] : '–'}
        </span>
        <span className="w-24 text-muted-foreground">
          {summary.outcomesTotal
            ? `${summary.outcomesAchieved}/${summary.outcomesTotal} done`
            : '–'}
        </span>
        <span
          className={cn(
            'flex w-28 items-center justify-end gap-1',
            reviewed ? 'text-now' : 'text-muted-foreground',
          )}
        >
          {reviewed && <CheckIcon className="size-3.5" />}
          {reviewed
            ? 'Reviewed'
            : summary.step > 0
              ? 'In progress'
              : 'Not reviewed'}
        </span>
      </Link>
    </li>
  );
}
