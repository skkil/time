import { focusedSeconds } from '@skkil-time/domain/timer';
import { InboxIcon, ListTodoIcon, PlayIcon, SquareIcon } from 'lucide-react';
import { useRef } from 'react';

import type { EntryDetails } from '@/backend';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectJump } from '@/features/projects/ProjectLink';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { useProjectIndex } from '@/features/projects/api';
import { TaskJump } from '@/features/tasks/TaskLink';
import { TaskPicker } from '@/features/tasks/TaskPicker';
import { useTaskIndex } from '@/features/tasks/api';
import { BreakNote, PauseButton } from '@/features/time/PauseButton';
import {
  useDiscardTimer,
  useEditTimer,
  useStartTimer,
  useStopTimer,
  useTimer,
} from '@/features/time/api';
import { useNow } from '@/hooks/use-now';
import { formatClockTime, formatStopwatch } from '@/lib/time';

const FIELD =
  'flex h-8 max-w-full items-center gap-2 rounded-full px-3 text-foreground/80 ring-1 ring-white/15 transition-colors outline-none hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/50';

export function StartFocus({
  open,
  onOpen,
}: {
  open: boolean;
  onOpen: () => void;
}) {
  const { data: timer } = useTimer();
  const start = useStartTimer();
  const now = useNow(1000, Boolean(timer));

  if (timer)
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] tabular-nums transition-colors hover:bg-white"
      >
        <span className="size-2 rounded-full bg-[#08161e]" />
        {open
          ? timer.pausedAt === null
            ? 'Focusing'
            : 'On a break'
          : formatStopwatch(focusedSeconds(timer, now))}
      </button>
    );

  return (
    <button
      type="button"
      disabled={start.isPending}
      onClick={() =>
        start.mutate(
          { description: '', projectId: null, taskId: null },
          { onSuccess: onOpen },
        )
      }
      className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
    >
      <PlayIcon className="size-3.5 fill-current" />
      Start focus
    </button>
  );
}

export function FreeFocus() {
  const { data: timer } = useTimer();
  const index = useProjectIndex();
  const tasks = useTaskIndex();
  const edit = useEditTimer();
  const stop = useStopTimer();
  const discard = useDiscardTimer();
  const now = useNow(1000, Boolean(timer));
  const input = useRef<HTMLInputElement>(null);
  if (!timer) return null;

  const current = (): EntryDetails => ({
    description: input.current?.value.trim() ?? timer.description,
    projectId: timer.projectId,
    taskId: timer.taskId,
  });
  const project =
    timer.projectId === null ? undefined : index.byId.get(timer.projectId);
  const task = timer.taskId === null ? undefined : tasks.byId.get(timer.taskId);

  return (
    <div className="flex h-full max-h-[720px] animate-in flex-col rounded-[32px] bg-[rgba(6,18,26,.38)] p-12 ring-1 ring-white/[.08] backdrop-blur-xl duration-200 fade-in-0 slide-in-from-bottom-2">
      <p className="text-sm text-foreground/75">
        {timer.pausedAt === null ? 'Focusing' : 'On a break'}
      </p>
      <input
        key={`${timer.startedAt}-${timer.taskId}`}
        ref={input}
        defaultValue={timer.description}
        placeholder="What are you on?"
        aria-label="What are you on?"
        onBlur={() => {
          if (current().description !== timer.description)
            edit.mutate(current());
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="mt-2 bg-transparent text-3xl font-light outline-none placeholder:text-foreground/35"
      />

      <dl className="mt-10 grid max-w-md grid-cols-[88px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-sm">
        <dt className="text-foreground/75">Task</dt>
        <dd className="flex min-w-0 items-center gap-2">
          <TaskPicker
            value={timer.taskId}
            onChange={(picked) =>
              edit.mutate(
                picked
                  ? {
                      description: current().description || picked.title,
                      projectId: picked.projectId,
                      taskId: picked.id,
                    }
                  : { ...current(), taskId: null },
              )
            }
            trigger={
              <button type="button" className={FIELD}>
                <ListTodoIcon className="size-3.5 text-foreground/75" />
                <span className="truncate">{task?.title ?? 'None'}</span>
              </button>
            }
          />
          {task && <TaskJump taskId={task.id} name={task.title} />}
        </dd>
        <dt className="text-foreground/75">Project</dt>
        <dd className="flex min-w-0 items-center gap-2">
          <ProjectPicker
            value={timer.projectId}
            onChange={(projectId) =>
              edit.mutate({ ...current(), projectId, taskId: null })
            }
            trigger={
              <button type="button" className={FIELD}>
                {project ? (
                  <ProjectDot color={project.color} />
                ) : (
                  <InboxIcon className="size-3.5 text-foreground/75" />
                )}
                <span className="truncate">{project?.name ?? 'None'}</span>
              </button>
            }
          />
          {project && (
            <ProjectJump projectId={project.id} name={project.name} />
          )}
        </dd>
        <dt className="text-foreground/75">Started</dt>
        <dd className="text-foreground/75 tabular-nums">
          {formatClockTime(timer.startedAt)}
        </dd>
      </dl>

      <div className="mt-auto flex items-center gap-4 pt-10">
        <span className="text-5xl font-extralight tracking-tight tabular-nums">
          {formatStopwatch(focusedSeconds(timer, now))}
        </span>
        <PauseButton timer={timer} />
        <button
          type="button"
          disabled={stop.isPending}
          onClick={() => stop.mutate(current())}
          className="flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
        >
          <SquareIcon className="size-3.5 fill-current" />
          Stop
        </button>
        <button
          type="button"
          disabled={discard.isPending}
          onClick={() => discard.mutate()}
          className="text-sm text-foreground/75 transition-colors hover:text-foreground"
        >
          Discard
        </button>
      </div>
      <BreakNote timer={timer} />
    </div>
  );
}
