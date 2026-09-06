import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type {
  Outcome,
  OutcomeStatus,
  Quarter,
  Week,
  WeekNotes,
} from '@/bindings';
import { FeltScale } from '@/components/FeltScale';
import { type Step, StepIndicator } from '@/components/StepIndicator';
import { Page, PageBody, PageHeader, SectionTitle } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSetTaskOutcome, useTasks } from '@/features/tasks/api';
import { FELT_LABELS } from '@/lib/felt';
import {
  type DateKey,
  dateKeyOf,
  formatWeekRange,
  isoWeekNumber,
  mondayOf,
  shiftKey,
  todayKey,
} from '@/lib/time';

import { ClearDeck } from './ClearDeck';
import { OutcomeCard } from './OutcomeCard';
import { OutcomePicker } from './OutcomePicker';
import { OutcomePlanner } from './OutcomePlanner';
import { QuarterSetup } from './QuarterSetup';
import {
  useFinishWeek,
  useQuarter,
  useRateWeek,
  useReachStep,
  useSaveWeekNotes,
  useSetOutcomeStatus,
  useUpdatePriority,
  useWeek,
} from './api';
import { QUARTER_WEEKS, count } from './format';

type StepId =
  'feel' | 'outcomes' | 'deck' | 'reflect' | 'plan' | 'quarter' | 'done';

const ORDINAL: Record<StepId, number> = {
  feel: 0,
  outcomes: 1,
  deck: 2,
  reflect: 3,
  plan: 4,
  quarter: 5,
  done: 6,
};

export function WeekReview({ week }: { week: DateKey }) {
  const title = `Week ${isoWeekNumber(week)} review`;

  return (
    <Page>
      <PageHeader
        title={title}
        meta={formatWeekRange(week)}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/reports/reviews">
              <ArrowLeftIcon />
              Review
            </Link>
          </Button>
        }
      />
      <PageBody>
        <div className="mx-auto grid max-w-3xl gap-8">
          <WeekReviewFlow week={week} />
        </div>
      </PageBody>
    </Page>
  );
}

export function WeekReviewFlow({
  week,
  onDone,
}: {
  week: DateKey;
  onDone?: () => void;
}) {
  const { data } = useWeek(week);
  const { data: quarter } = useQuarter(week);
  if (week > mondayOf(todayKey()))
    return (
      <p className="text-sm text-muted-foreground">
        This week hasn’t started yet. Plan its outcomes from Reports.
      </p>
    );
  if (!data || quarter === undefined) return null;
  return (
    <ReviewFlow key={week} week={data} quarter={quarter} onDone={onDone} />
  );
}

function ReviewFlow({
  week,
  quarter,
  onDone,
}: {
  week: Week;
  quarter: Quarter | null;
  onDone?: () => void;
}) {
  const monday = week.startDate;
  const navigate = useNavigate();
  const reach = useReachStep(monday);
  const finish = useFinishWeek(monday);

  const steps: (Step & { id: StepId })[] = [
    { id: 'feel', label: 'Feel' },
    { id: 'outcomes', label: 'Outcomes' },
    { id: 'deck', label: 'Clear the deck' },
    { id: 'reflect', label: 'One change' },
    { id: 'plan', label: 'Plan next week' },
    ...(quarter?.weekNo === QUARTER_WEEKS
      ? [{ id: 'quarter' as const, label: 'Quarter' }]
      : []),
    { id: 'done', label: 'Done' },
  ];
  const indexOf = (ordinal: number) =>
    steps.findLastIndex((step) => ORDINAL[step.id] <= ordinal);
  const reviewed = week.reviewedAt !== null;
  const [current, setCurrent] = useState(
    reviewed ? steps.length - 1 : indexOf(week.step),
  );
  const reached = Math.max(current, indexOf(week.step));
  const step = steps[current];

  const blocker =
    step.id === 'feel' && week.felt === null
      ? 'Pick how the week felt to continue.'
      : step.id === 'outcomes' &&
          week.outcomes.some((outcome) => outcome.status === 'open')
        ? 'Decide on every outcome to continue.'
        : null;

  const go = (index: number) => {
    const target = steps[index];
    if (target.id === 'done') finish.mutate();
    else reach.mutate(ORDINAL[target.id]);
    setCurrent(index);
  };

  return (
    <>
      <StepIndicator
        steps={steps}
        current={current}
        reached={reviewed ? steps.length - 1 : reached}
        onSelect={setCurrent}
      />
      <section aria-live="polite">
        {step.id === 'feel' && <FeelStep week={week} />}
        {step.id === 'outcomes' && (
          <OutcomesStep week={week} quarter={quarter} />
        )}
        {step.id === 'deck' && (
          <>
            <StepHeading title="Clear the deck">
              Tidy what’s piling up so next week starts light.
            </StepHeading>
            <ClearDeck nextMonday={shiftKey(monday, 7)} />
          </>
        )}
        {step.id === 'reflect' && <ReflectStep week={week} />}
        {step.id === 'plan' && <PlanStep week={week} />}
        {step.id === 'quarter' && quarter && (
          <QuarterStep week={week} quarter={quarter} />
        )}
        {step.id === 'done' && (
          <DoneStep week={week} onEdit={() => setCurrent(0)} />
        )}
      </section>
      {step.id !== 'done' && (
        <footer className="flex items-center gap-3 border-t pt-4">
          {current > 0 && (
            <Button variant="ghost" onClick={() => setCurrent(current - 1)}>
              <ArrowLeftIcon />
              Back
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground">
            {blocker}
          </span>
          <Button disabled={blocker !== null} onClick={() => go(current + 1)}>
            {steps[current + 1].id === 'done' ? 'Finish review' : 'Next'}
            <ArrowRightIcon />
          </Button>
        </footer>
      )}
      {step.id === 'done' && (
        <footer className="flex justify-end border-t pt-4">
          <Button
            onClick={() =>
              onDone ? onDone() : navigate({ to: '/reports/weeks' })
            }
          >
            {onDone ? 'Close' : 'Back to Reviews'}
          </Button>
        </footer>
      )}
    </>
  );
}

function StepHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 grid gap-1">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

function FeelStep({ week }: { week: Week }) {
  const rate = useRateWeek(week.startDate);
  return (
    <>
      <StepHeading title="How did the week feel?">
        Answer before you see any numbers. Your gut is part of the record.
      </StepHeading>
      <FeltScale
        value={week.felt}
        label="How the week felt"
        onChange={(felt) => rate.mutate(felt)}
      />
    </>
  );
}

const MAX_CARRIES = 2;

const DECISIONS: { value: OutcomeStatus; label: string }[] = [
  { value: 'achieved', label: 'Achieved' },
  { value: 'carried', label: 'Not yet' },
  { value: 'dropped', label: 'Dropped' },
];

function OutcomesStep({
  week,
  quarter,
}: {
  week: Week;
  quarter: Quarter | null;
}) {
  const setStatus = useSetOutcomeStatus();
  return (
    <div className="grid gap-8">
      <div>
        <StepHeading title="Did each outcome happen?">
          “Not yet” carries it into next week with its open tasks. After two
          carries, shrink it, re-date it, or let it go.
        </StepHeading>
        {week.outcomes.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            No outcomes were set for this week. You’ll set next week’s in a
            moment.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-md border bg-card">
            {week.outcomes.map((outcome) => (
              <OutcomeCard
                key={outcome.id}
                outcome={outcome}
                quarter={quarter}
                showTasks
                actions={
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={outcome.status === 'open' ? '' : outcome.status}
                    aria-label={`Did “${outcome.title}” happen?`}
                    onValueChange={(value) =>
                      value &&
                      setStatus.mutate({
                        id: outcome.id,
                        status: value as OutcomeStatus,
                      })
                    }
                  >
                    {DECISIONS.map((decision) => (
                      <ToggleGroupItem
                        key={decision.value}
                        value={decision.value}
                        className="px-3"
                        disabled={
                          decision.value === 'carried' &&
                          outcome.timesCarried >= MAX_CARRIES &&
                          outcome.status !== 'carried'
                        }
                        title={
                          decision.value === 'carried' &&
                          outcome.timesCarried >= MAX_CARRIES
                            ? 'Carried twice already. Rename it smaller in the plan step, or drop it.'
                            : undefined
                        }
                      >
                        {decision.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                }
              />
            ))}
          </ul>
        )}
      </div>
      <AlsoFinished week={week} outcomes={week.outcomes} />
    </div>
  );
}

function AlsoFinished({ week, outcomes }: { week: Week; outcomes: Outcome[] }) {
  const { data: tasks = [] } = useTasks();
  const setOutcome = useSetTaskOutcome();
  const end = shiftKey(week.startDate, 7);
  const finished = tasks.filter(
    (task) =>
      task.completedAt !== null &&
      task.outcomeId === null &&
      task.parentId === null &&
      dateKeyOf(task.completedAt) >= week.startDate &&
      dateKeyOf(task.completedAt) < end,
  );
  if (finished.length === 0) return null;
  return (
    <section aria-labelledby="also-title">
      <SectionTitle aside={count(finished.length, 'task')}>
        <span id="also-title">Also finished</span>
      </SectionTitle>
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {finished.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-3 px-4 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">{task.title}</span>
            {outcomes.length > 0 && (
              <OutcomePicker
                value={null}
                weeks={[week.startDate]}
                onChange={(outcomeId) =>
                  setOutcome.mutate({ id: task.id, outcomeId })
                }
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const OPTIONAL_PROMPTS: {
  key: keyof WeekNotes;
  label: string;
  placeholder: string;
}[] = [
  { key: 'worked', label: 'What worked', placeholder: 'Keep doing' },
  {
    key: 'fellShort',
    label: 'What fell short, and why',
    placeholder: 'Be specific, not harsh',
  },
];
const PROMPT_KEYS: (keyof WeekNotes)[] = ['worked', 'fellShort', 'change'];

function ReflectStep({ week }: { week: Week }) {
  const { data: previous } = useWeek(shiftKey(week.startDate, -7));
  const save = useSaveWeekNotes(week.startDate);
  const [notes, setNotes] = useState(week.notes);
  const [saved, setSaved] = useState(week.notes);

  const commit = () => {
    if (PROMPT_KEYS.some((key) => notes[key] !== saved[key]))
      save.mutate(notes, { onSuccess: () => setSaved(notes) });
  };

  return (
    <>
      <StepHeading title="One change for next week">
        Small enough to actually do.
      </StepHeading>
      {previous?.notes.change && (
        <p className="mb-5 rounded-md bg-muted px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            The change you picked last week:{' '}
          </span>
          {previous.notes.change}
        </p>
      )}
      <div className="grid gap-4">
        <Textarea
          aria-label="One change for next week"
          rows={2}
          value={notes.change}
          placeholder="e.g. no meetings before 11 on Tuesdays"
          maxLength={2000}
          onChange={(event) =>
            setNotes({ ...notes, change: event.target.value })
          }
          onBlur={commit}
        />
        <details>
          <summary className="cursor-pointer text-sm text-muted-foreground">
            More reflection (optional)
          </summary>
          <div className="mt-3 grid gap-4">
            {OPTIONAL_PROMPTS.map((prompt) => (
              <div key={prompt.key} className="grid gap-1.5">
                <Label htmlFor={`note-${prompt.key}`}>{prompt.label}</Label>
                <Textarea
                  id={`note-${prompt.key}`}
                  rows={2}
                  value={notes[prompt.key]}
                  placeholder={prompt.placeholder}
                  maxLength={2000}
                  onChange={(event) =>
                    setNotes({ ...notes, [prompt.key]: event.target.value })
                  }
                  onBlur={commit}
                />
              </div>
            ))}
          </div>
        </details>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {save.isPending
            ? 'Saving…'
            : PROMPT_KEYS.some((key) => saved[key])
              ? 'Saved'
              : ''}
        </p>
      </div>
    </>
  );
}

function PlanStep({ week }: { week: Week }) {
  const next = shiftKey(week.startDate, 7);
  const { data: quarter = null } = useQuarter(next);
  return (
    <>
      <StepHeading title={`Plan week ${isoWeekNumber(next)}`}>
        Up to 3 outcomes for {formatWeekRange(next)}. Anything you marked “Not
        yet” is already here.
      </StepHeading>
      {week.notes.change && (
        <p className="mb-5 rounded-md bg-muted px-4 py-3 text-sm">
          <span className="text-muted-foreground">Your one change: </span>
          {week.notes.change}
        </p>
      )}
      <OutcomePlanner week={next} quarter={quarter} />
    </>
  );
}

function QuarterStep({ week, quarter }: { week: Week; quarter: Quarter }) {
  const next = shiftKey(week.startDate, 7);
  const { data: nextQuarter } = useQuarter(next);
  return (
    <div className="grid gap-8">
      <div>
        <StepHeading title={`${quarter.label} is ending`}>
          For each priority: keep it, change it, or drop it. Nothing carries
          over on its own.
        </StepHeading>
        <ul className="divide-y overflow-hidden rounded-md border bg-card">
          {quarter.priorities.map((priority) => (
            <PriorityWrapUp key={priority.id} priority={priority} />
          ))}
          {quarter.priorities.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              This quarter had no priorities.
            </li>
          )}
        </ul>
      </div>
      <section aria-labelledby="next-quarter-title">
        <SectionTitle>
          <span id="next-quarter-title">Next quarter</span>
        </SectionTitle>
        {nextQuarter ? (
          <p className="text-sm text-muted-foreground">
            {nextQuarter.label} is planned with {nextQuarter.priorities.length}{' '}
            priorities.
          </p>
        ) : (
          nextQuarter === null && <QuarterSetup start={next} priorities={[]} />
        )}
      </section>
    </div>
  );
}

function PriorityWrapUp({
  priority,
}: {
  priority: Quarter['priorities'][number];
}) {
  const update = useUpdatePriority();
  const [note, setNote] = useState(priority.note);
  return (
    <li className="grid gap-2 px-4 py-3">
      <p className="flex items-baseline justify-between gap-4">
        <span className="font-medium">{priority.title}</span>
        <span className="text-xs text-muted-foreground">
          {count(priority.achieved, 'outcome')} achieved
        </span>
      </p>
      <Textarea
        rows={2}
        value={note}
        maxLength={2000}
        aria-label={`Note on ${priority.title}`}
        placeholder="Keep, change or drop, and why?"
        onChange={(event) => setNote(event.target.value)}
        onBlur={() =>
          note !== priority.note &&
          update.mutate({ id: priority.id, title: priority.title, note })
        }
      />
    </li>
  );
}

function DoneStep({ week, onEdit }: { week: Week; onEdit: () => void }) {
  const next = shiftKey(week.startDate, 7);
  const { data: upcoming } = useWeek(next);
  const { data: quarter = null } = useQuarter(next);
  const achieved = week.outcomes.filter(
    (outcome) => outcome.status === 'achieved',
  ).length;
  const planned = (upcoming?.outcomes ?? []).filter(
    (outcome) => outcome.status !== 'dropped',
  );
  return (
    <>
      <StepHeading title="Review done">
        Week {isoWeekNumber(week.startDate)} is on the record.
      </StepHeading>
      <dl className="mb-6 grid grid-cols-2 overflow-hidden rounded-md border bg-card">
        <div className="border-r px-4 py-3">
          <dt className="text-xs text-muted-foreground">Felt</dt>
          <dd className="mt-0.5 font-medium">
            {week.felt ? FELT_LABELS[week.felt - 1] : '–'}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Outcomes achieved</dt>
          <dd className="mt-0.5 font-medium">
            {week.outcomes.length ? `${achieved}/${week.outcomes.length}` : '–'}
          </dd>
        </div>
      </dl>
      <SectionTitle
        aside={
          <Button size="xs" variant="ghost" onClick={onEdit}>
            Edit review
          </Button>
        }
      >
        Week {isoWeekNumber(next)} outcomes
      </SectionTitle>
      {planned.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-md border bg-card">
          {planned.map((outcome) => (
            <OutcomeCard key={outcome.id} outcome={outcome} quarter={quarter} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No outcomes planned.</p>
      )}
    </>
  );
}
