import type { DraggableAttributes } from '@dnd-kit/core';
import type { useSortable } from '@dnd-kit/sortable';
import {
  CalendarIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  StarIcon,
  SunsetIcon,
  Trash2Icon,
} from 'lucide-react';

import type { Task } from '@/bindings';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProjectIndex } from '@/features/projects/api';
import { useStartTimer, useTimer } from '@/features/time/api';
import { formatDuration, formatEstimate, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { PriorityCheck } from './PriorityCheck';
import {
  taskToInput,
  useDeleteTask,
  useSections,
  useSetTaskCompleted,
  useSetTaskMust,
  useSetTasksSomeday,
  useTaskIndex,
  useUpdateTask,
} from './api';
import { DuePicker, PriorityFlag } from './fields';
import { PRIORITIES, formatDate, formatDue } from './meta';
import { useTaskDialog } from './task-dialog-context';

export type TaskItemProps = {
  task: Task;
  showPlacement?: boolean;
  showParent?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onIndent?: () => void;
  onOutdent?: () => void;
  dragHandle?: {
    attributes: DraggableAttributes;
    listeners: ReturnType<typeof useSortable>['listeners'];
  };
  dragging?: boolean;
  variant?: 'row' | 'card';
};

export function TaskItem({
  task,
  showPlacement = false,
  showParent = false,
  expanded,
  onToggleExpanded,
  onIndent,
  onOutdent,
  dragHandle,
  dragging = false,
  variant = 'row',
}: TaskItemProps) {
  const complete = useSetTaskCompleted();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const setMust = useSetTaskMust();
  const setSomeday = useSetTasksSomeday();
  const start = useStartTimer();
  const { data: timer } = useTimer();
  const { data: sections } = useSections();
  const tasks = useTaskIndex();
  const index = useProjectIndex();
  const { openTask } = useTaskDialog();
  const today = todayKey();
  const done = task.completedAt !== null;
  const running = timer?.taskId === task.id;
  const children = tasks.children.get(task.id) ?? [];
  const finished = children.filter(
    (child) => child.completedAt !== null,
  ).length;
  const project =
    task.projectId === null ? undefined : index.byId.get(task.projectId);
  const section = sections?.find((s) => s.id === task.sectionId);
  const parent =
    task.parentId === null ? undefined : tasks.byId.get(task.parentId);
  const save = (patch: Partial<ReturnType<typeof taskToInput>>) =>
    update.mutate({ id: task.id, input: { ...taskToInput(task), ...patch } });

  return (
    <div
      className={cn(
        'group/task relative flex items-start gap-2.5',
        variant === 'row'
          ? 'border-b border-white/[.06] py-2.5 pr-1'
          : 'mb-2 rounded-2xl bg-white/[.06] p-3 ring-1 ring-white/10 backdrop-blur-md',
        dragging && 'opacity-40',
      )}
    >
      <div
        className={cn(
          'absolute flex w-9 items-center justify-end',
          variant === 'row'
            ? 'top-2 -left-10'
            : 'top-2.5 -left-1 w-auto -translate-x-full',
        )}
      >
        {dragHandle && (
          <button
            type="button"
            aria-label={`Move ${task.title}`}
            className="cursor-grab rounded-sm p-0.5 text-muted-foreground opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
            {...dragHandle.attributes}
            {...dragHandle.listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        )}
        {onToggleExpanded && children.length > 0 && (
          <button
            type="button"
            aria-label={expanded ? 'Hide sub-tasks' : 'Show sub-tasks'}
            aria-expanded={expanded}
            onClick={onToggleExpanded}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronRightIcon
              className={cn(
                'size-4 transition-transform',
                expanded && 'rotate-90',
              )}
            />
          </button>
        )}
      </div>

      <PriorityCheck
        priority={task.priority}
        checked={done}
        label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className="mt-0.5"
        onToggle={() => complete.mutate({ id: task.id, completed: !done })}
      />

      <button
        type="button"
        onClick={() => openTask(task.id)}
        className="min-w-0 flex-1 rounded-sm text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className={cn(
            'block text-[15px] leading-5 break-words',
            done && 'text-foreground/40 line-through',
          )}
        >
          {task.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-foreground/45 empty:hidden">
          {[
            task.dueDate &&
              `${formatDue(task, today)}${task.recurrence ? `, ${task.recurrence}` : ''}`,
            task.deadline && `due by ${formatDate(task.deadline, today)}`,
            task.estimateMinutes !== null &&
              `about ${formatEstimate(task.estimateMinutes)}`,
            task.trackedSeconds > 0 &&
              `${formatDuration(task.trackedSeconds)} spent`,
            children.length > 0 && `${finished} of ${children.length} steps`,
            task.priority < 4 && `priority ${task.priority}`,
            !done && task.rolloverCount >= 2 && `moved ${task.rolloverCount}×`,
            showParent && parent && `in ${parent.title}`,
            showPlacement &&
              variant === 'row' &&
              `${project?.name ?? 'Inbox'}${section ? ` / ${section.name}` : ''}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </button>

      {!done && (
        <div
          className={cn(
            'absolute right-0 flex items-center rounded-md bg-popover opacity-0 group-focus-within/task:opacity-100 group-hover/task:opacity-100 has-[[data-state=open]]:opacity-100',
            variant === 'row' ? 'top-1.5' : 'top-2 right-2 bg-card',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Edit ${task.title}`}
                onClick={() => openTask(task.id)}
              >
                <PencilIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <DuePicker
            value={task}
            onChange={(due) => save(due)}
            trigger={
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Set date for ${task.title}`}
              >
                <CalendarIcon />
              </Button>
            }
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Track time on ${task.title}`}
                disabled={running}
                className={cn(running && 'text-now')}
                onClick={() =>
                  start.mutate({
                    description: task.title,
                    projectId: task.projectId,
                    taskId: task.id,
                  })
                }
              >
                <PlayIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {running ? 'Timer running' : 'Start timer'}
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`More actions for ${task.title}`}
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Priority
              </DropdownMenuLabel>
              <div className="flex gap-1 px-2 pb-1.5">
                {PRIORITIES.map((priority) => (
                  <Button
                    key={priority}
                    size="icon-sm"
                    variant={task.priority === priority ? 'secondary' : 'ghost'}
                    aria-label={`Priority ${priority}`}
                    onClick={() => save({ priority })}
                  >
                    <PriorityFlag priority={priority} />
                  </Button>
                ))}
              </div>
              <DropdownMenuSeparator />
              {onIndent && (
                <DropdownMenuItem onSelect={onIndent}>
                  <IndentIncreaseIcon />
                  Make sub-task
                </DropdownMenuItem>
              )}
              {onOutdent && (
                <DropdownMenuItem onSelect={onOutdent}>
                  <IndentDecreaseIcon />
                  Move out of parent
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => openTask(task.id)}>
                <PencilIcon />
                Edit task
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setMust.mutate({
                    id: task.id,
                    mustOn: task.mustOn === today ? null : today,
                  })
                }
              >
                <StarIcon />
                {task.mustOn === today ? 'Not a must today' : 'Must do today'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setSomeday.mutate({ ids: [task.id], someday: !task.someday })
                }
              >
                <SunsetIcon />
                {task.someday ? 'Bring back from Someday' : 'Move to Someday'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => remove.mutate(task.id)}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
