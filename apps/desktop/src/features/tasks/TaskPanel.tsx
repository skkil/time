import { format } from 'date-fns';
import {
  CheckIcon,
  ChevronRightIcon,
  EllipsisIcon,
  Link2Icon,
  PlayIcon,
  SquareIcon,
  SunsetIcon,
  Trash2Icon,
} from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';

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
import { ProjectJump } from '@/features/projects/ProjectLink';
import { useProjectIndex } from '@/features/projects/api';
import { PhasePager } from '@/features/records/PhasePager';
import { OutcomePicker } from '@/features/review/OutcomePicker';
import { useWeek } from '@/features/review/api';
import { useStartTimer, useStopTimer, useTimer } from '@/features/time/api';
import { EventLine, WorkflowLine } from '@/features/workflow/TaskWorkflow';
import { useProjectWorkflow } from '@/features/workflow/api';
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

import { Dependencies } from './Dependencies';
import { DueText } from './DueText';
import { Dot, Phrase } from './Phrase';
import { AddStepForm, StepRow } from './StepRow';
import { TaskFocus } from './TaskFocus';
import {
  stepInput,
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
import { useTaskDialog } from './task-dialog-context';

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
  const [waiting, setWaiting] = useState(false);
  const done = task.completedAt !== null;
  const workflow = useProjectWorkflow(task.projectId);
  const isRecord = task.kind === 'record' && workflow.statuses.length > 0;
  const project =
    task.projectId === null ? undefined : index.byId.get(task.projectId);
  const section = sections?.find((s) => s.id === task.sectionId);
  const parent =
    task.parentId === null ? undefined : tasks.byId.get(task.parentId);

  const save = (patch: Partial<TaskInput>) =>
    update.mutate({ id: task.id, input: { ...taskToInput(task), ...patch } });

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex items-center gap-2 text-sm text-foreground/75">
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
                <span className="text-foreground/75">/ {section.name}</span>
              )}
            </Phrase>
          }
        />
        <ProjectJump
          projectId={task.projectId}
          name={project?.name ?? 'Inbox'}
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
        <MoreMenu task={task} onWait={() => setWaiting(true)} />
      </div>

      <textarea
        value={title}
        aria-label="Task name"
        rows={1}
        maxLength={500}
        className={cn(
          'mt-4 field-sizing-content shrink-0 resize-none overflow-hidden bg-transparent text-4xl leading-tight font-light text-balance outline-none',
          done && 'text-foreground/75 line-through',
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
      <EventLine task={task} />
      <WorkflowLine task={task} />
      <Serves task={task} />
      <Dependencies task={task} adding={waiting} onAddingChange={setWaiting} />

      <div className="mt-8 grid min-h-0 max-w-2xl content-start gap-8 overflow-y-auto pr-2">
        {task.nextStep && (
          <div>
            <p className="text-xs tracking-wide text-foreground/75">
              Where you left off
            </p>
            <p className="mt-1.5 text-lg font-light">{task.nextStep}</p>
          </div>
        )}
        <Notes
          saved={task.notes}
          label={isRecord ? 'Notes for every phase' : 'Notes'}
          onSave={(notes) => save({ notes })}
        />
        {isRecord ? (
          <PhasePager key={task.id} task={task} />
        ) : (
          <Steps task={task} />
        )}
        <TaskFocus taskId={task.id} />
      </div>

      <Actions
        task={task}
        finishable={task.kind !== 'event' && !isRecord}
        onToggleDone={() => complete.mutate({ id: task.id, completed: !done })}
      />
    </div>
  );
}

function Notes({
  saved,
  label,
  onSave,
}: {
  saved: string;
  label: string;
  onSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(saved);
  const [open, setOpen] = useState(false);
  const preview = notes.trim().split('\n')[0];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-w-0 items-center gap-2 rounded-sm text-left text-[15px] leading-relaxed text-foreground/75 transition-colors outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <ChevronRightIcon
          className={cn(
            'size-3.5 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="shrink-0">{label}</span>
        {!open && preview && (
          <span className="min-w-0 truncate text-foreground/75">{preview}</span>
        )}
      </button>
      {open && (
        <textarea
          autoFocus
          value={notes}
          aria-label={label}
          className="field-sizing-content min-h-12 resize-none bg-transparent pl-5.5 text-[15px] leading-relaxed text-foreground/80 outline-none"
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => notes !== saved && onSave(notes)}
        />
      )}
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
          {task.dueDate ? <DueText task={task} /> : 'No date'}
          {task.recurrence && (
            <span className="text-foreground/75"> · {task.recurrence}</span>
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
      <span key="tracked" className="text-foreground/75">
        {formatDuration(task.trackedSeconds)} focused
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
    <p className="mt-1.5 text-[15px] text-foreground/75">
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
  const steps = tasks.children.get(task.id) ?? [];

  return (
    <section aria-label="Steps" className="grid gap-1">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
      <AddStepForm
        label="Add a step"
        onAdd={(title) => create.mutate(stepInput(task, title))}
      />
    </section>
  );
}

function Actions({
  task,
  finishable,
  onToggleDone,
}: {
  task: Task;
  finishable: boolean;
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
            className="ml-4 flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
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
            className="flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
          >
            <PlayIcon className="size-3.5 fill-current" />
            Begin
          </button>
        )
      )}
      {finishable && (
        <button
          type="button"
          onClick={onToggleDone}
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-foreground/75 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <CheckIcon className="size-4" strokeWidth={1.5} />
          {done ? 'Not done' : 'Done'}
        </button>
      )}
    </div>
  );
}

function MoreMenu({ task, onWait }: { task: Task; onWait: () => void }) {
  const waitChosen = useRef(false);
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
            className="ml-auto grid size-8 place-items-center rounded-full text-foreground/75 transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <EllipsisIcon className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52"
          onCloseAutoFocus={(event) => {
            if (!waitChosen.current) return;
            waitChosen.current = false;
            event.preventDefault();
            onWait();
          }}
        >
          <DropdownMenuItem
            onSelect={() =>
              someday.mutate({ ids: [task.id], someday: !task.someday })
            }
          >
            <SunsetIcon />
            {task.someday ? 'Bring back' : 'Move to Someday'}
          </DropdownMenuItem>
          {task.completedAt === null && (
            <DropdownMenuItem onSelect={() => (waitChosen.current = true)}>
              <Link2Icon />
              Wait on another task
            </DropdownMenuItem>
          )}
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
              Its steps and planned blocks go too. Focus time stays in your log,
              unlinked.
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
