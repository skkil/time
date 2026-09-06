import { format } from 'date-fns';
import {
  CheckIcon,
  EllipsisIcon,
  PlayIcon,
  PlusIcon,
  SquareIcon,
  SunsetIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  forwardRef,
  useState,
} from 'react';

import type { Task, TaskInput } from '@/bindings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { OutcomePicker } from '@/features/review/OutcomePicker';
import { useWeek } from '@/features/review/api';
import { useStartTimer, useStopTimer, useTimer } from '@/features/time/api';
import { useNow } from '@/hooks/use-now';
import {
  formatDuration,
  formatEstimate,
  formatStopwatch,
  fromDateKey,
  mondayOf,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import {
  EMPTY_TASK,
  taskToInput,
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useSections,
  useSetTaskCompleted,
  useSetTaskOutcome,
  useSetTasksSomeday,
  useTaskIndex,
  useUpdateTask,
} from './api';
import {
  DeadlinePicker,
  DuePicker,
  EstimatePicker,
  PlacementPicker,
  PriorityPicker,
} from './fields';
import { formatDue } from './meta';
import { useTaskDialog } from './task-dialog-context';

const Phrase = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { set: boolean }
>(function Phrase({ set, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        '-mx-1 rounded-md px-1 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-white/40',
        set ? 'text-foreground/80' : 'text-foreground/35',
        className,
      )}
      {...props}
    />
  );
});

function Dot() {
  return <span className="text-foreground/25">·</span>;
}

export function TaskPanel({
  task,
  className,
}: {
  task: Task;
  className?: string;
}) {
  const update = useUpdateTask();
  const move = useMoveTask();
  const complete = useSetTaskCompleted();
  const index = useProjectIndex();
  const tasks = useTaskIndex();
  const { data: sections } = useSections();
  const { openTask } = useTaskDialog();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const done = task.completedAt !== null;
  const project =
    task.projectId === null ? undefined : index.byId.get(task.projectId);
  const section = sections?.find((s) => s.id === task.sectionId);
  const parent =
    task.parentId === null ? undefined : tasks.byId.get(task.parentId);

  const save = (patch: Partial<TaskInput>) =>
    update.mutate({ id: task.id, input: { ...taskToInput(task), ...patch } });

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex items-center gap-2 text-sm text-foreground/60">
        <PlacementPicker
          value={{ projectId: task.projectId, sectionId: task.sectionId }}
          onChange={(placement) =>
            move.mutate({
              id: task.id,
              placement: { ...placement, parentId: null, before: null },
            })
          }
          trigger={
            <Phrase set className="flex items-center gap-2">
              {project && <ProjectDot color={project.color} />}
              {project?.name ?? 'Inbox'}
              {section && (
                <span className="text-foreground/45">/ {section.name}</span>
              )}
            </Phrase>
          }
        />
        {parent && (
          <>
            <Dot />
            <button
              type="button"
              onClick={() => openTask(parent.id)}
              className="truncate hover:text-foreground hover:underline"
            >
              {parent.title}
            </button>
          </>
        )}
        <MoreMenu task={task} />
      </div>

      <textarea
        value={title}
        aria-label="Task name"
        rows={1}
        maxLength={500}
        className={cn(
          'mt-4 field-sizing-content resize-none bg-transparent text-4xl leading-tight font-light text-balance outline-none',
          done && 'text-foreground/50 line-through',
        )}
        onChange={(event) => setTitle(event.target.value.replace(/\n/g, ''))}
        onBlur={() =>
          title.trim() && title !== task.title
            ? save({ title: title.trim() })
            : setTitle(task.title)
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />

      <Details task={task} save={save} />
      <Serves task={task} />

      <div className="mt-8 grid min-h-0 max-w-2xl content-start gap-8 overflow-y-auto pr-2">
        {task.nextStep && (
          <div>
            <p className="text-xs tracking-wide text-foreground/45">
              Where you left off
            </p>
            <p className="mt-1.5 text-lg font-light">{task.nextStep}</p>
          </div>
        )}
        <textarea
          value={notes}
          aria-label="Notes"
          placeholder="Notes"
          className="field-sizing-content min-h-12 resize-none bg-transparent text-[15px] leading-relaxed text-foreground/80 outline-none placeholder:text-foreground/30"
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => notes !== task.notes && save({ notes })}
        />
        <Steps task={task} />
      </div>

      <Actions
        task={task}
        onToggleDone={() => complete.mutate({ id: task.id, completed: !done })}
      />
    </div>
  );
}

function Details({
  task,
  save,
}: {
  task: Task;
  save: (patch: Partial<TaskInput>) => void;
}) {
  const parts: ReactNode[] = [
    <DuePicker
      key="due"
      value={task}
      onChange={(due) => save(due)}
      trigger={
        <Phrase set={task.dueDate !== null}>
          {task.dueDate ? formatDue(task) : 'No date'}
          {task.recurrence && (
            <span className="text-foreground/50"> · {task.recurrence}</span>
          )}
        </Phrase>
      }
    />,
    <EstimatePicker
      key="estimate"
      value={task.estimateMinutes}
      onChange={(estimateMinutes) => save({ estimateMinutes })}
      trigger={
        <Phrase set={task.estimateMinutes !== null}>
          {task.estimateMinutes
            ? `about ${formatEstimate(task.estimateMinutes)}`
            : 'how long?'}
        </Phrase>
      }
    />,
  ];
  if (task.trackedSeconds > 0)
    parts.push(
      <span key="tracked" className="text-foreground/55">
        {formatDuration(task.trackedSeconds)} so far
      </span>,
    );
  parts.push(
    <DeadlinePicker
      key="deadline"
      value={task.deadline}
      onChange={(deadline) => save({ deadline })}
      trigger={
        <Phrase set={task.deadline !== null}>
          {task.deadline
            ? `due by ${format(fromDateKey(task.deadline), 'd MMM')}`
            : 'deadline'}
        </Phrase>
      }
    />,
    <PriorityPicker
      key="priority"
      value={task.priority}
      onChange={(priority) => save({ priority })}
      trigger={
        <Phrase set={task.priority < 4}>
          {task.priority < 4 ? `priority ${task.priority}` : 'priority'}
        </Phrase>
      }
    />,
  );

  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px]">
      {parts.map((part, i) => (
        <span key={i} className="flex items-baseline gap-2">
          {i > 0 && <Dot />}
          {part}
        </span>
      ))}
    </p>
  );
}

function Serves({ task }: { task: Task }) {
  const thisMonday = mondayOf(todayKey());
  const { data: current } = useWeek(thisMonday);
  const { data: next } = useWeek(shiftKey(thisMonday, 7));
  const setOutcome = useSetTaskOutcome();
  const available =
    (current?.outcomes.length ?? 0) + (next?.outcomes.length ?? 0) > 0;
  if (!available && task.outcomeId === null) return null;
  return (
    <p className="mt-1.5 text-[15px] text-foreground/45">
      Serves{' '}
      <OutcomePicker
        value={task.outcomeId}
        onChange={(outcomeId) => setOutcome.mutate({ id: task.id, outcomeId })}
        trigger={(selected) => (
          <Phrase set={task.outcomeId !== null}>
            {selected?.title ??
              (task.outcomeId !== null
                ? 'an earlier outcome'
                : 'no outcome yet')}
          </Phrase>
        )}
      />
    </p>
  );
}

function Steps({ task }: { task: Task }) {
  const tasks = useTaskIndex();
  const create = useCreateTask();
  const complete = useSetTaskCompleted();
  const [draft, setDraft] = useState('');
  const steps = tasks.children.get(task.id) ?? [];

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    create.mutate({
      ...EMPTY_TASK,
      title: draft.trim(),
      projectId: task.projectId,
      sectionId: task.sectionId,
      parentId: task.id,
    });
    setDraft('');
  };

  return (
    <section aria-label="Steps" className="grid gap-1">
      {steps.map((step) => {
        const finished = step.completedAt !== null;
        return (
          <label
            key={step.id}
            className="group flex cursor-pointer items-center gap-3 py-1.5"
          >
            <button
              type="button"
              aria-label={
                finished ? `Reopen ${step.title}` : `Finish ${step.title}`
              }
              onClick={() =>
                complete.mutate({ id: step.id, completed: !finished })
              }
              className={cn(
                'grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors',
                finished
                  ? 'border-white/50 bg-white/50 text-[#0b1a22]'
                  : 'border-white/40 group-hover:border-white/80',
              )}
            >
              {finished && <CheckIcon className="size-3" strokeWidth={2.5} />}
            </button>
            <span
              className={cn(
                'text-[15px]',
                finished
                  ? 'text-foreground/40 line-through'
                  : 'text-foreground/85',
              )}
            >
              {step.title}
            </span>
          </label>
        );
      })}
      <form onSubmit={add} className="flex items-center gap-3 py-1.5">
        <PlusIcon
          className="size-[18px] text-foreground/35"
          strokeWidth={1.5}
        />
        <input
          value={draft}
          aria-label="Add a step"
          placeholder="Add a step"
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-foreground/35"
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
    </section>
  );
}

function Actions({
  task,
  onToggleDone,
}: {
  task: Task;
  onToggleDone: () => void;
}) {
  const { data: timer } = useTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const running = timer?.taskId === task.id;
  const now = useNow(1000, running);
  const done = task.completedAt !== null;

  return (
    <div className="mt-auto flex flex-wrap items-center gap-3 pt-10">
      {running ? (
        <>
          <span className="text-5xl font-extralight tracking-tight tabular-nums">
            {formatStopwatch(now - timer.startedAt)}
          </span>
          <button
            type="button"
            onClick={() => stop.mutate(undefined)}
            className="ml-4 flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
          >
            <SquareIcon className="size-3.5 fill-current" />
            Stop
          </button>
        </>
      ) : (
        !done && (
          <button
            type="button"
            disabled={start.isPending}
            onClick={() =>
              start.mutate({
                description: task.title,
                projectId: task.projectId,
                taskId: task.id,
              })
            }
            className="flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
          >
            <PlayIcon className="size-3.5 fill-current" />
            Begin
          </button>
        )
      )}
      <button
        type="button"
        onClick={onToggleDone}
        className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-foreground/75 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-foreground"
      >
        <CheckIcon className="size-4" strokeWidth={1.5} />
        {done ? 'Not done' : 'Done'}
      </button>
    </div>
  );
}

function MoreMenu({ task }: { task: Task }) {
  const remove = useDeleteTask();
  const someday = useSetTasksSomeday();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More"
            className="ml-auto grid size-8 place-items-center rounded-full text-foreground/50 transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <EllipsisIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() =>
              someday.mutate({ ids: [task.id], someday: !task.someday })
            }
          >
            <SunsetIcon />
            {task.someday ? 'Bring back' : 'Move to Someday'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirming(true)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{task.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its steps and planned blocks go too. Tracked time stays in your
              log, unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(task.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
