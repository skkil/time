import { CheckIcon, StarIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import type { Id, Task } from '@/backend';
import { FeltScale } from '@/components/FeltScale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Leftovers } from '@/features/day/Leftovers';
import { earlierTasks, nextActions } from '@/features/day/plan';
import { HabitCell } from '@/features/habits/HabitCell';
import { useDueHabits, useSetHabitStatus } from '@/features/habits/api';
import { useBlocks, useCreateBlock } from '@/features/planner/api';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectLink } from '@/features/projects/ProjectLink';
import { useProjectIndex, useProjects } from '@/features/projects/api';
import { useDays, useRateDay, useSaveDayNote } from '@/features/review/api';
import { TaskJump, TaskLink } from '@/features/tasks/TaskLink';
import {
  EMPTY_TASK,
  useCreateTask,
  useSetTaskCompleted,
  useSetTaskMust,
  useSetTaskNextStep,
  useTaskIndex,
  useTasks,
} from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import { useNow } from '@/hooks/use-now';
import {
  atMinutes,
  dateKeyOf,
  dayStart,
  formatClockTime,
  formatDuration,
  formatEstimate,
  formatMinutesOfDay,
  mondayOf,
  secondsWithin,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { MAX_MUSTS, type RitualContext, type StepKey, prompt } from './meta';

export function StepHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-2 grid justify-items-center gap-2 text-center">
      <h2 className="text-[30px] leading-tight font-light tracking-tight text-balance">
        {title}
      </h2>
      {children && (
        <p className="max-w-md text-sm text-muted-foreground">{children}</p>
      )}
    </div>
  );
}

const dayWord = (ctx: RitualContext) =>
  ctx.date === todayKey() ? 'today' : 'yesterday';
const targetWord = (ctx: RitualContext) =>
  ctx.target === todayKey() ? 'today' : 'tomorrow';

export function RitualStep({
  step,
  ctx,
  onNext,
}: {
  step: StepKey;
  ctx: RitualContext;
  onNext: () => void;
}) {
  switch (step) {
    case 'feel':
      return <FeelStep ctx={ctx} onNext={onNext} />;
    case 'what_moved':
      return <WhatMovedStep ctx={ctx} />;
    case 'leftovers':
      return <LeftoversStep ctx={ctx} />;
    case 'pick_musts':
      return <PickMustsStep ctx={ctx} />;
    case 'timeblock':
      return <TimeblockStep ctx={ctx} />;
    case 'one_line_note':
      return <NoteStep ctx={ctx} />;
    case 'habit_check':
      return <HabitStep ctx={ctx} />;
    case 'breathing_pause':
      return <BreathingStep />;
    case 'next_step_note':
      return <NextStepNote ctx={ctx} onNext={onNext} />;
    case 'did_it_move':
      return <DidItMoveStep ctx={ctx} onNext={onNext} />;
    case 'brain_dump':
      return <BrainDumpStep />;
    case 'device_away':
      return <DeviceAwayStep />;
    default:
      return null;
  }
}

function FeelStep({ ctx, onNext }: { ctx: RitualContext; onNext: () => void }) {
  const { data: days } = useDays(ctx.date, shiftKey(ctx.date, 1));
  const rate = useRateDay();
  const felt = days?.find((day) => day.date === ctx.date)?.felt ?? null;
  return (
    <div className="grid gap-6">
      <StepHeading title={prompt('feel', ctx.date, dayWord(ctx))}>
        Before any numbers.
      </StepHeading>
      <FeltScale
        value={felt}
        label={`How ${dayWord(ctx)} felt`}
        onChange={(value) =>
          rate.mutate({ date: ctx.date, felt: value }, { onSuccess: onNext })
        }
      />
    </div>
  );
}

function WhatMovedStep({ ctx }: { ctx: RitualContext }) {
  const { data: tasks } = useTasks();
  const { data: entries } = useTimeEntries(ctx.date, shiftKey(ctx.date, 1));
  const index = useProjectIndex();
  const start = dayStart(ctx.date);
  const end = dayStart(shiftKey(ctx.date, 1));
  const done = (tasks ?? []).filter(
    (task) =>
      task.completedAt !== null &&
      task.completedAt >= start &&
      task.completedAt < end,
  );
  const byProject = new Map<Id | null, number>();
  for (const entry of entries ?? [])
    byProject.set(
      entry.projectId,
      (byProject.get(entry.projectId) ?? 0) +
        secondsWithin(entry, ctx.date, shiftKey(ctx.date, 1)),
    );
  const total = [...byProject.values()].reduce((sum, value) => sum + value, 0);

  return (
    <div className="grid gap-5">
      <StepHeading title={prompt('what_moved', ctx.date)}>
        {done.length === 0 && total === 0
          ? 'Nothing logged. That’s information too, not a grade.'
          : `${done.length} finished · ${formatDuration(total)} focused`}
      </StepHeading>
      {done.length > 0 && (
        <ul className="grid gap-1.5">
          {done.map((task) => {
            const project =
              task.projectId === null
                ? undefined
                : index.byId.get(task.projectId);
            return (
              <li key={task.id} className="flex items-center gap-2 text-sm">
                <CheckIcon className="size-4 text-due-today" />
                <TaskLink taskId={task.id} className="flex-1 truncate">
                  {task.title}
                </TaskLink>
                <ProjectDot color={project?.color} />
              </li>
            );
          })}
        </ul>
      )}
      {byProject.size > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {[...byProject.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([projectId, seconds]) => {
              const project =
                projectId === null ? undefined : index.byId.get(projectId);
              return (
                <li key={projectId ?? 0} className="flex items-center gap-1.5">
                  <ProjectDot color={project?.color} />
                  {project ? (
                    <ProjectLink projectId={project.id}>
                      {project.name}
                    </ProjectLink>
                  ) : (
                    'No project'
                  )}{' '}
                  <span className="text-foreground">
                    {formatDuration(seconds)}
                  </span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

function LeftoversStep({ ctx }: { ctx: RitualContext }) {
  const { data: tasks } = useTasks();
  const { data: blocks } = useBlocks(mondayOf(ctx.date));
  const now = useNow(60_000);
  const leftovers = useMemo(() => {
    const ahead = new Set(
      (blocks ?? [])
        .filter(
          (block) => dateKeyOf(block.startAt) === ctx.date && block.endAt > now,
        )
        .map((block) => block.taskId),
    );
    const stillPlanned = (task: Task) =>
      task.dueDate === ctx.date &&
      (ahead.has(task.id) ||
        (task.dueTime !== null && atMinutes(ctx.date, task.dueTime) > now));
    return earlierTasks(tasks ?? [], ctx.target).filter(
      (task) => !stillPlanned(task),
    );
  }, [tasks, blocks, ctx.date, ctx.target, now]);
  return (
    <div className="grid gap-5">
      <StepHeading title="Leftovers">
        Give each one {targetWord(ctx)}, another day, Someday, or let it go.
        Nothing rolls over on its own.
      </StepHeading>
      <Leftovers tasks={leftovers} target={ctx.target} />
    </div>
  );
}

function PickMustsStep({ ctx }: { ctx: RitualContext }) {
  const { data: tasks } = useTasks();
  const { data: projects } = useProjects();
  const setMust = useSetTaskMust();
  const index = useProjectIndex();
  const all = tasks ?? [];
  const open = (task: Task) => task.completedAt === null && !task.someday;
  const musts = all.filter((task) => open(task) && task.mustOn === ctx.target);
  const candidates = useMemo(() => {
    const all = tasks ?? [];
    const seen = new Set<Id>();
    const list: Task[] = [];
    const add = (task: Task) => {
      if (seen.has(task.id) || !open(task)) return;
      seen.add(task.id);
      list.push(task);
    };
    all.filter((task) => task.mustOn === ctx.target).forEach(add);
    all
      .filter((task) => task.dueDate !== null && task.dueDate <= ctx.target)
      .sort((a, b) => a.priority - b.priority)
      .forEach(add);
    nextActions(projects ?? [], all).forEach(({ task }) => add(task));
    return list.slice(0, 12);
  }, [tasks, projects, ctx.target]);
  const estimate = musts.reduce(
    (sum, task) => sum + (task.estimateMinutes ?? 0),
    0,
  );

  return (
    <div className="grid gap-5">
      <StepHeading title={`What would make ${targetWord(ctx)} count?`}>
        Pick up to {MAX_MUSTS}. Important beats urgent.
        {estimate > 0 && ` About ${formatEstimate(estimate)} estimated.`}
      </StepHeading>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No candidates yet. Add a task with + Add and come back.
        </p>
      ) : (
        <ul className="grid gap-1">
          {candidates.map((task) => {
            const chosen = task.mustOn === ctx.target;
            const full = !chosen && musts.length >= MAX_MUSTS;
            const project =
              task.projectId === null
                ? undefined
                : index.byId.get(task.projectId);
            return (
              <li key={task.id} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={full}
                  aria-pressed={chosen}
                  onClick={() =>
                    setMust.mutate({
                      id: task.id,
                      mustOn: chosen ? null : ctx.target,
                    })
                  }
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
                    chosen
                      ? 'border-primary bg-now-tint'
                      : 'bg-card hover:border-foreground/30',
                  )}
                >
                  <StarIcon
                    className={cn(
                      'size-4 shrink-0',
                      chosen
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {task.estimateMinutes &&
                      formatEstimate(task.estimateMinutes)}
                    <ProjectDot color={project?.color} />
                  </span>
                </button>
                <TaskJump taskId={task.id} name={task.title} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const SLOTS = [9 * 60, 11 * 60, 14 * 60, 16 * 60, 19 * 60];

function TimeblockStep({ ctx }: { ctx: RitualContext }) {
  const monday = mondayOf(ctx.target);
  const { data: blocks } = useBlocks(monday);
  const { data: tasks } = useTasks();
  const create = useCreateBlock(monday);
  const dayBlocks = (blocks ?? [])
    .filter((block) => dateKeyOf(block.startAt) === ctx.target)
    .sort((a, b) => a.startAt - b.startAt);
  const blocked = new Set(dayBlocks.map((block) => block.taskId));
  const allMusts = (tasks ?? []).filter(
    (task) => task.completedAt === null && task.mustOn === ctx.target,
  );
  const musts = allMusts.filter((task) => !blocked.has(task.id));
  const taken = (minute: number) => {
    const at = atMinutes(ctx.target, minute);
    return dayBlocks.some((block) => block.startAt <= at && block.endAt > at);
  };

  return (
    <div className="grid gap-5">
      <StepHeading title="Give each must a time">
        A when makes it far more likely to happen. Rough is fine.
      </StepHeading>
      {musts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {allMusts.length === 0
            ? `No musts picked for ${targetWord(ctx)}, so there’s nothing to place. Continue when you’re ready.`
            : 'Every must has a time. Open Week to fine-tune.'}
        </p>
      )}
      <ul className="grid gap-3">
        {musts.map((task) => (
          <li
            key={task.id}
            className="grid gap-2 rounded-md border bg-card p-3"
          >
            <TaskLink taskId={task.id} className="text-sm font-medium">
              {task.title}
            </TaskLink>
            <div className="flex flex-wrap gap-1.5">
              {SLOTS.map((minute) => (
                <Button
                  key={minute}
                  size="xs"
                  variant="outline"
                  disabled={taken(minute)}
                  onClick={() => {
                    const startAt = atMinutes(ctx.target, minute);
                    create.mutate({
                      taskId: task.id,
                      span: {
                        startAt,
                        endAt: startAt + (task.estimateMinutes ?? 60) * 60,
                      },
                    });
                  }}
                >
                  {formatMinutesOfDay(minute)}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {dayBlocks.length > 0 && (
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {dayBlocks.map((block) => (
            <li key={block.id} className="flex gap-3">
              <span className="w-24 shrink-0">
                {formatClockTime(block.startAt)}–{formatClockTime(block.endAt)}
              </span>
              <TaskLink
                taskId={block.taskId}
                className="truncate text-foreground"
              >
                {block.title}
              </TaskLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteStep({ ctx }: { ctx: RitualContext }) {
  const { data: days } = useDays(ctx.date, shiftKey(ctx.date, 1));
  const save = useSaveDayNote();
  const stored = days?.find((day) => day.date === ctx.date)?.note ?? '';
  const [note, setNote] = useState<string | null>(null);
  const value = note ?? stored;
  return (
    <div className="grid gap-5">
      <StepHeading title={prompt('one_line_note', ctx.date)}>
        Optional. Saved as you go.
      </StepHeading>
      <Input
        autoFocus
        value={value}
        maxLength={280}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() =>
          note !== null && save.mutate({ date: ctx.date, note: value })
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {save.isSuccess && <p className="text-xs text-muted-foreground">Saved</p>}
    </div>
  );
}

function HabitStep({ ctx }: { ctx: RitualContext }) {
  const { due = [], lookup } = useDueHabits(ctx.date);
  const setStatus = useSetHabitStatus();
  return (
    <div className="grid gap-5">
      <StepHeading title="Habits">
        {due.length === 0 ? 'None due today.' : 'Tap the ones you did.'}
      </StepHeading>
      <ul className="grid gap-2">
        {due.map((habit) => (
          <li key={habit.id} className="flex items-center gap-3">
            <HabitCell
              day={lookup(habit.id, ctx.date)}
              label={habit.name}
              onChange={(status) =>
                setStatus.mutate({ habitId: habit.id, date: ctx.date, status })
              }
            />
            <span className="text-sm">{habit.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const BREATH_SECONDS = 30;

function BreathingStep() {
  const now = useNow(1000);
  const [startedAt] = useState(now);
  const left = Math.max(0, BREATH_SECONDS - (now - startedAt));
  return (
    <div className="grid justify-items-center gap-6 py-4 text-center">
      <StepHeading title="Breathe">In for four, out for six.</StepHeading>
      <div className="relative grid size-40 place-items-center">
        <span className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-[zen-breathe_10s_ease-in-out_infinite]" />
        <span className="relative text-3xl font-semibold text-primary">
          {left}
        </span>
      </div>
    </div>
  );
}

function NextStepNote({
  ctx,
  onNext,
}: {
  ctx: RitualContext;
  onNext: () => void;
}) {
  const tasks = useTaskIndex();
  const save = useSetTaskNextStep();
  const task = ctx.taskId === null ? undefined : tasks.byId.get(ctx.taskId);
  const [value, setValue] = useState<string | null>(null);
  const text = value ?? task?.nextStep ?? '';
  if (!task)
    return (
      <StepHeading title="Where will you pick up?">
        This session had no task, so there’s nothing to note.
      </StepHeading>
    );
  const commit = () => {
    if (value !== null) save.mutate({ id: task.id, nextStep: text });
  };
  return (
    <div className="grid gap-5">
      <StepHeading title="Where will you pick up?">
        One line for future you on “{task.title}”. It shows when you start
        again.
      </StepHeading>
      <Input
        autoFocus
        value={text}
        maxLength={500}
        placeholder="e.g. finish the second paragraph, then cite Radford 2021"
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
            onNext();
          }
        }}
      />
    </div>
  );
}

function DidItMoveStep({
  ctx,
  onNext,
}: {
  ctx: RitualContext;
  onNext: () => void;
}) {
  const tasks = useTaskIndex();
  const complete = useSetTaskCompleted();
  const task = ctx.taskId === null ? undefined : tasks.byId.get(ctx.taskId);
  return (
    <div className="grid gap-6">
      <StepHeading title="Did it move?">
        {task ? task.title : 'The session you just stopped.'}
      </StepHeading>
      <div className="grid grid-cols-3 gap-2">
        {task && (
          <Button
            size="lg"
            variant="outline"
            onClick={() =>
              complete.mutate(
                { id: task.id, completed: true },
                { onSuccess: onNext },
              )
            }
          >
            Done
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={onNext}>
          Partly
        </Button>
        <Button size="lg" variant="outline" onClick={onNext}>
          Not yet
        </Button>
      </div>
    </div>
  );
}

function BrainDumpStep() {
  const create = useCreateTask();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(0);
  const flush = () => {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    for (const title of lines) create.mutate({ ...EMPTY_TASK, title });
    if (lines.length) setSaved((count) => count + lines.length);
    setText('');
  };
  return (
    <div className="grid gap-5">
      <StepHeading title="What’s still on your mind?">
        One per line, as specific as you can. They go to Inbox, so you don’t
        have to hold them overnight.
      </StepHeading>
      <Textarea
        autoFocus
        rows={6}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={flush}
      />
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={flush}>
          Send to Inbox
        </Button>
        {saved > 0 && (
          <span className="text-xs text-muted-foreground">
            {saved} in Inbox
          </span>
        )}
      </div>
    </div>
  );
}

function DeviceAwayStep() {
  return (
    <div className="grid justify-items-center gap-3 py-8 text-center">
      <StepHeading title="That’s everything.">
        Tomorrow is written down. Put the device away.
      </StepHeading>
    </div>
  );
}
