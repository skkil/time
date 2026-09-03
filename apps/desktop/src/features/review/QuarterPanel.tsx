import { Link } from '@tanstack/react-router';
import { CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';

import type { Priority, Quarter } from '@/bindings';
import { SectionTitle } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTimeEntries } from '@/features/time/api';
import {
  type DateKey,
  dateKeyOf,
  formatDuration,
  formatWeekRange,
  mondayOf,
  shiftKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import {
  useCreatePriority,
  useQuarter,
  useRemovePriority,
  useSaveQuarter,
  useUpdatePriority,
  useWeeks,
} from './api';
import { QUARTER_WEEKS, count, quarterLabel } from './format';

const MAX_PRIORITIES = 3;

export function QuarterPanel({ week }: { week: DateKey }) {
  const { data: quarter, isPending } = useQuarter(week);
  if (isPending) return null;
  return (
    <section aria-labelledby="quarter-title">
      {quarter ? (
        <QuarterOverview quarter={quarter} week={week} />
      ) : (
        <>
          <SectionTitle>
            <span id="quarter-title">Quarter</span>
          </SectionTitle>
          <QuarterSetup start={week} />
        </>
      )}
    </section>
  );
}

export function QuarterSetup({
  start: initialStart,
  priorities: initialPriorities = [],
  onDone,
}: {
  start: DateKey;
  priorities?: string[];
  onDone?: () => void;
}) {
  const save = useSaveQuarter();
  const addPriority = useCreatePriority();
  const [start, setStart] = useState(initialStart);
  const [label, setLabel] = useState(quarterLabel(initialStart));
  const [priorities, setPriorities] = useState(
    [...initialPriorities, '', '', ''].slice(0, MAX_PRIORITIES),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(
      { id: null, label, startDate: mondayOf(start) },
      {
        onSuccess: async (quarterId) => {
          for (const title of priorities.filter((item) => item.trim()))
            await addPriority.mutateAsync({ quarterId, title });
          onDone?.();
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-md border bg-card p-4"
    >
      <p className="text-sm text-muted-foreground">
        Pick up to 3 priorities for the next 13 weeks. Each week’s outcomes can
        serve one of them.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="quarter-label">Name</Label>
          <Input
            id="quarter-label"
            value={label}
            maxLength={40}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="quarter-start">Starts the week of</Label>
          <Input
            id="quarter-start"
            type="date"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setLabel(quarterLabel(event.target.value));
            }}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Priorities</Label>
        {priorities.map((value, i) => (
          <Input
            key={i}
            value={value}
            maxLength={200}
            aria-label={`Priority ${i + 1}`}
            placeholder={i === 0 ? 'e.g. Finish the thesis draft' : 'Optional'}
            onChange={(event) =>
              setPriorities(
                priorities.map((item, j) =>
                  j === i ? event.target.value : item,
                ),
              )
            }
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!label.trim() || !start || save.isPending}
        >
          Start quarter
        </Button>
      </div>
    </form>
  );
}

function QuarterOverview({
  quarter,
  week,
}: {
  quarter: Quarter;
  week: DateKey;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <SectionTitle
        aside={
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setEditing(!editing)}
          >
            {editing ? <CheckIcon /> : <PencilIcon />}
            {editing ? 'Done' : 'Edit'}
          </Button>
        }
      >
        <span id="quarter-title">
          {quarter.label}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            Week {quarter.weekNo} of {QUARTER_WEEKS}
          </span>
        </span>
      </SectionTitle>
      <div className="grid gap-4 rounded-md border bg-card p-4">
        {editing && <QuarterNameForm quarter={quarter} />}
        <Priorities quarter={quarter} editing={editing} />
        <WeekCells quarter={quarter} week={week} />
      </div>
    </>
  );
}

function QuarterNameForm({ quarter }: { quarter: Quarter }) {
  const save = useSaveQuarter();
  const [label, setLabel] = useState(quarter.label);
  const [start, setStart] = useState(quarter.startDate);
  const commit = () => {
    if (
      label.trim() &&
      (label !== quarter.label || start !== quarter.startDate)
    )
      save.mutate({ id: quarter.id, label, startDate: mondayOf(start) });
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="quarter-name">Name</Label>
        <Input
          id="quarter-name"
          value={label}
          maxLength={40}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={commit}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="quarter-start-edit">Starts the week of</Label>
        <Input
          id="quarter-start-edit"
          type="date"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          onBlur={commit}
        />
      </div>
    </div>
  );
}

function Priorities({
  quarter,
  editing,
}: {
  quarter: Quarter;
  editing: boolean;
}) {
  const add = useCreatePriority();
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim())
      add.mutate(
        { quarterId: quarter.id, title },
        { onSuccess: () => setTitle('') },
      );
  };

  return (
    <div className="grid gap-1">
      {quarter.priorities.length === 0 && !editing && (
        <p className="text-sm text-muted-foreground">
          No priorities yet. Use Edit to add up to 3.
        </p>
      )}
      <ol className="grid gap-1">
        {quarter.priorities.map((priority, i) => (
          <PriorityRow
            key={priority.id}
            priority={priority}
            index={i}
            editing={editing}
          />
        ))}
      </ol>
      {editing && quarter.priorities.length < MAX_PRIORITIES && (
        <form onSubmit={submit} className="mt-1 flex gap-2">
          <Input
            value={title}
            maxLength={200}
            placeholder="Add a priority"
            aria-label="New priority"
            onChange={(event) => setTitle(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!title.trim() || add.isPending}
          >
            Add
          </Button>
        </form>
      )}
    </div>
  );
}

function PriorityRow({
  priority,
  index,
  editing,
}: {
  priority: Priority;
  index: number;
  editing: boolean;
}) {
  const update = useUpdatePriority();
  const remove = useRemovePriority();
  const [title, setTitle] = useState(priority.title);
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-4 text-xs text-muted-foreground">{index + 1}</span>
      {editing ? (
        <Input
          value={title}
          maxLength={200}
          aria-label={`Priority ${index + 1}`}
          className="h-8"
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() =>
            title.trim() &&
            title !== priority.title &&
            update.mutate({ id: priority.id, title, note: priority.note })
          }
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{priority.title}</span>
      )}
      <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
        {count(priority.achieved, 'outcome')} achieved
      </span>
      {editing && (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Remove ${priority.title}`}
          onClick={() => remove.mutate(priority.id)}
        >
          <XIcon />
        </Button>
      )}
    </li>
  );
}

function WeekCells({ quarter, week }: { quarter: Quarter; week: DateKey }) {
  const end = shiftKey(quarter.startDate, QUARTER_WEEKS * 7);
  const { data: summaries = [] } = useWeeks(quarter.startDate, end);
  const { data: entries = [] } = useTimeEntries(quarter.startDate, end);

  const tracked = useMemo(() => {
    const totals = new Map<DateKey, number>();
    for (const entry of entries) {
      const monday = mondayOf(dateKeyOf(entry.startedAt));
      totals.set(
        monday,
        (totals.get(monday) ?? 0) + entry.endedAt - entry.startedAt,
      );
    }
    return totals;
  }, [entries]);

  return (
    <ol className="grid grid-cols-13 gap-1" aria-label="Weeks">
      {Array.from({ length: QUARTER_WEEKS }, (_, i) => {
        const monday = shiftKey(quarter.startDate, i * 7);
        const summary = summaries.find((item) => item.startDate === monday);
        const current = monday === week;
        const future = monday > week;
        const reviewed = summary?.reviewedAt != null;
        return (
          <li key={monday}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/review/$week"
                  params={{ week: monday }}
                  disabled={future}
                  aria-current={current ? 'true' : undefined}
                  className={cn(
                    'grid h-14 content-between rounded-sm border px-1.5 py-1 text-[11px] outline-none hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring',
                    current && 'border-today bg-today-tint',
                    future && 'pointer-events-none border-dashed opacity-60',
                  )}
                >
                  <span className="flex items-center justify-between text-muted-foreground">
                    {i + 1}
                    {reviewed && <CheckIcon className="size-3 text-now" />}
                  </span>
                  <span className="font-medium">
                    {summary?.outcomesTotal
                      ? `${summary.outcomesAchieved}/${summary.outcomesTotal}`
                      : '–'}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                {formatWeekRange(monday)} ·{' '}
                {formatDuration(tracked.get(monday) ?? 0)} tracked
                {reviewed ? ' · Reviewed' : ''}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}
