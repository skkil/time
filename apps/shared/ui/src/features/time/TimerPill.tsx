import { focusedSeconds } from '@skkil-time/rules/timer';
import { Link } from '@tanstack/react-router';
import { SquareIcon } from 'lucide-react';

import type { Id } from '@/backend';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProjectLink } from '@/features/projects/ProjectLink';
import { useProjectIndex } from '@/features/projects/api';
import { TaskLink } from '@/features/tasks/TaskLink';
import { useTaskIndex } from '@/features/tasks/api';
import { useNow } from '@/hooks/use-now';
import { formatStopwatch, todayKey, weekStartOf } from '@/lib/time';
import { cn } from '@/lib/utils';

import { PauseButton } from './PauseButton';
import { useStopTimer, useTimer } from './api';

const SUBJECT = 'ml-2 block max-w-40 truncate text-xs text-foreground/75';

function TimerSubject({
  label,
  taskId,
  projectId,
}: {
  label: string;
  taskId?: Id;
  projectId?: Id;
}) {
  if (taskId !== undefined)
    return (
      <TaskLink taskId={taskId} className={SUBJECT}>
        {label}
      </TaskLink>
    );
  if (projectId !== undefined)
    return (
      <ProjectLink projectId={projectId} className={SUBJECT}>
        {label}
      </ProjectLink>
    );
  return <span className={SUBJECT}>{label}</span>;
}

export function TimerPill() {
  const { data: timer } = useTimer();
  const stop = useStopTimer();
  const index = useProjectIndex();
  const tasks = useTaskIndex();
  const now = useNow(1000, Boolean(timer));
  if (!timer) return null;

  const task = timer.taskId === null ? undefined : tasks.byId.get(timer.taskId);
  const project = timer.projectId ? index.byId.get(timer.projectId) : undefined;

  return (
    <div className="flex h-9 items-center gap-1 rounded-full bg-white/10 pr-1.5 pl-3.5 text-foreground backdrop-blur-md">
      <Link
        to="/"
        search={{ view: 'day', week: weekStartOf(todayKey()) }}
        className="flex min-w-0 items-center gap-2 rounded-sm text-xs outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground"
      >
        <span
          className={cn(
            'font-semibold',
            timer.pausedAt !== null && 'text-foreground/75',
          )}
        >
          {formatStopwatch(focusedSeconds(timer, now))}
        </span>
      </Link>
      <TimerSubject
        label={task?.title || timer.description || project?.name || 'Focus'}
        taskId={task?.id}
        projectId={project?.id}
      />
      <PauseButton timer={timer} compact />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-xs"
            variant="ghost"
            className="rounded-full text-foreground hover:bg-white/15"
            aria-label="Stop focus"
            onClick={() => stop.mutate(undefined)}
          >
            <SquareIcon className="fill-current" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Stop and log</TooltipContent>
      </Tooltip>
    </div>
  );
}
