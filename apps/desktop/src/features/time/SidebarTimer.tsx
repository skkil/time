import { Link } from '@tanstack/react-router';
import { PlayIcon, SquareIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { useNow } from '@/hooks/use-now';
import { formatStopwatch, mondayOf, todayKey } from '@/lib/time';

import { useStartTimer, useStopTimer, useTimer } from './api';

export function SidebarTimer() {
  const { data: timer } = useTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const index = useProjectIndex();
  const now = useNow(1000, Boolean(timer));
  const project = timer?.projectId
    ? index.byId.get(timer.projectId)
    : undefined;

  if (!timer) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-2 text-muted-foreground">
        <span className="text-xs">00:00:00</span>
        <span className="truncate text-xs">No timer running</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="ml-auto"
              aria-label="Start timer"
              onClick={() =>
                start.mutate({ description: '', projectId: null, taskId: null })
              }
            >
              <PlayIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Start a timer</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-now-tint px-2 py-2">
      <Link
        to="/time"
        search={{ week: mondayOf(todayKey()) }}
        className="min-w-0 flex-1 rounded-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div className="text-sm font-medium text-now">
          {formatStopwatch(now - timer.startedAt)}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {project && <ProjectDot color={project.color} />}
          <span className="truncate">
            {timer.description || project?.name || 'No description'}
          </span>
        </div>
      </Link>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
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
