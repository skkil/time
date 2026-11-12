import {
  SOMEDAY,
  dayTarget,
  targetLabel,
  weekTarget,
} from '@skkil-time/rules/move';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';

import type { BlockMove, MoveTarget, Task } from '@/backend';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectLink } from '@/features/projects/ProjectLink';
import { useProjectIndex } from '@/features/projects/api';
import { DueText } from '@/features/tasks/DueText';
import { TaskLink } from '@/features/tasks/TaskLink';
import {
  useDeleteTasks,
  useMoveTasks,
  useSetTaskCompleted,
} from '@/features/tasks/api';
import { isStale } from '@/features/tasks/meta';
import { mondayOf, shiftKey, toDateKey, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

export function Leftovers({
  tasks,
  target,
  className,
}: {
  tasks: Task[];
  target: MoveTarget;
  className?: string;
}) {
  const move = useMoveTasks();
  const drop = useDeleteTasks();
  const skip = useSetTaskCompleted();
  const index = useProjectIndex();
  const [blocksFollow, setBlocksFollow] = useState(true);
  const today = todayKey();
  const blocks: BlockMove = blocksFollow ? 'follow' : 'leave';
  const moveTo = (ids: Task['id'][], to: MoveTarget) =>
    move.mutate({ ids, target: to, blocks });
  const label = targetLabel(target, today);
  const nextDay =
    target.kind === 'day'
      ? {
          target: dayTarget(shiftKey(target.date, 1)),
          label: target.date === today ? 'Tomorrow' : 'Day after',
        }
      : null;
  const thisWeek = weekTarget(mondayOf(today));
  const nextWeek = weekTarget(shiftKey(mondayOf(today), 7));
  const offerWeek = target.kind === 'day';
  const oneOffIds = tasks
    .filter((task) => task.recurrence === null)
    .map((task) => task.id);

  if (tasks.length === 0)
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Nothing here. Clean slate.
      </p>
    );

  return (
    <div className={cn('grid min-w-0 gap-3', className)}>
      <ul className="grid min-w-0 divide-y divide-white/10 border-y border-white/10">
        {tasks.map((task) => {
          const project =
            task.projectId === null
              ? undefined
              : index.byId.get(task.projectId);
          const oneOff = task.recurrence === null;
          const stale = oneOff && isStale(task, today);
          const later: LaterOption[] = [
            ...(nextDay ? [nextDay] : []),
            ...(offerWeek && oneOff
              ? [{ label: 'This week', target: thisWeek }]
              : []),
            ...(oneOff
              ? [
                  { label: 'Next week', target: nextWeek },
                  { label: 'Someday', target: SOMEDAY },
                ]
              : []),
          ];
          return (
            <li
              key={task.id}
              className="flex min-w-0 items-center gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <TaskLink
                  taskId={task.id}
                  className="block w-full truncate text-sm"
                >
                  {task.title}
                </TaskLink>
                <p className="flex min-w-0 items-center gap-x-1.5 text-xs whitespace-nowrap text-muted-foreground">
                  <ProjectLink
                    projectId={task.projectId}
                    className="flex min-w-0 items-center gap-1.5"
                  >
                    <ProjectDot color={project?.color} />
                    <span className="truncate">{project?.name ?? 'Inbox'}</span>
                  </ProjectLink>
                  {task.dueDate && (
                    <span>
                      · <DueText task={task} />
                    </span>
                  )}
                  {task.rolloverCount >= 2 && (
                    <span>· moved ×{task.rolloverCount}</span>
                  )}
                  {stale && <span>· park it?</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => moveTo([task.id], stale ? SOMEDAY : target)}
                >
                  {stale ? 'Someday' : label}
                </Button>
                <Later
                  options={stale ? [{ label, target }, ...later] : later}
                  onPick={(to) => moveTo([task.id], to)}
                />
                {oneOff ? (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="w-12 text-muted-foreground"
                    onClick={() => drop.mutate([task.id])}
                  >
                    Drop
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="w-12 text-muted-foreground"
                    title="Skip this one and keep the repeat"
                    onClick={() =>
                      skip.mutate({ id: task.id, completed: true })
                    }
                  >
                    Skip
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {tasks.length > 1 && (
          <span className="flex flex-wrap items-center gap-2">
            All {tasks.length}:
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                moveTo(
                  tasks.map((task) => task.id),
                  target,
                )
              }
            >
              {label}
            </Button>
            {offerWeek && oneOffIds.length > 0 && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => moveTo(oneOffIds, thisWeek)}
              >
                This week
              </Button>
            )}
            {oneOffIds.length > 0 && (
              <Button
                size="xs"
                variant="ghost"
                title="Park every one-off task in Someday and start clean"
                onClick={() => moveTo(oneOffIds, SOMEDAY)}
              >
                Fresh start
              </Button>
            )}
          </span>
        )}
        <label className="flex items-center gap-2">
          <Checkbox
            checked={blocksFollow}
            onCheckedChange={(checked) => setBlocksFollow(checked === true)}
          />
          Focus blocks move with their tasks
        </label>
      </div>
    </div>
  );
}

type LaterOption = { label: string; target: MoveTarget };

function Later({
  options,
  onPick,
}: {
  options: LaterOption[];
  onPick: (target: MoveTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const pick = (target: MoveTarget) => {
    setOpen(false);
    onPick(target);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="xs" variant="ghost">
          Later
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {options.length > 0 && (
          <div className="grid border-b p-1">
            {options.map((option) => (
              <button
                key={option.label}
                type="button"
                className="flex h-8 items-center rounded-sm px-2 text-sm hover:bg-accent"
                onClick={() => pick(option.target)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        <Calendar
          mode="single"
          weekStartsOn={1}
          disabled={{ before: new Date() }}
          onSelect={(date) => date && pick(dayTarget(toDateKey(date)))}
        />
      </PopoverContent>
    </Popover>
  );
}
