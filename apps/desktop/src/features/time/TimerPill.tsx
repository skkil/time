import { Link } from '@tanstack/react-router';
import { SquareIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProjectIndex } from '@/features/projects/api';
import { useTaskIndex } from '@/features/tasks/api';
import { useNow } from '@/hooks/use-now';
import { formatStopwatch, mondayOf, todayKey } from '@/lib/time';

import { useStopTimer, useTimer } from './api';

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
    <div className="flex h-8 items-center gap-1 rounded-full bg-white/10 pr-1 pl-3 text-foreground backdrop-blur-md">
      <Link
        to="/"
        search={{ view: 'day', week: mondayOf(todayKey()) }}
        className="flex min-w-0 items-center gap-2 rounded-sm text-xs outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground"
      >
        <span className="font-semibold">
          {formatStopwatch(now - timer.startedAt)}
        </span>
        <span className="max-w-40 truncate text-foreground/60">
          {task?.title || timer.description || project?.name || 'Timer'}
        </span>
      </Link>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-xs"
            variant="ghost"
            className="rounded-full text-foreground hover:bg-white/15"
            aria-label="Stop timer"
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
