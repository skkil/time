import type { DraggableAttributes } from '@dnd-kit/core';
import type { useSortable } from '@dnd-kit/sortable';
import {
  CalendarIcon,
  ChevronRightIcon,
  GitForkIcon,
  GripVerticalIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  RepeatIcon,
  TargetIcon,
  TimerIcon,
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
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { useStartTimer, useTimer } from '@/features/time/api';
import { formatDuration, formatEstimate, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { PriorityCheck } from './PriorityCheck';
import {
  taskToInput,
  useDeleteTask,
  useLabels,
  useSections,
  useSetTaskCompleted,
  useTaskIndex,
  useUpdateTask,
} from './api';
import { DuePicker, PriorityFlag } from './fields';
import {
  PRIORITIES,
  dueTone,
  dueToneClass,
  formatDate,
  formatDue,
} from './meta';
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
  const start = useStartTimer();
  const { data: timer } = useTimer();
  const { data: labels } = useLabels();
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
  const taskLabels = (labels ?? []).filter((label) =>
    task.labelIds.includes(label.id),
  );
  const firstLine = task.notes.split('\n')[0];
  const tone = task.dueDate ? dueTone(task.dueDate, today) : 'later';
  const save = (patch: Partial<ReturnType<typeof taskToInput>>) =>
    update.mutate({ id: task.id, input: { ...taskToInput(task), ...patch } });

  return (
    <div
      className={cn(
        'group/task relative flex items-start gap-2.5',
        variant === 'row'
          ? 'border-b py-2 pr-1'
          : 'mb-2 rounded-lg border bg-card p-2.5 shadow-xs',
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
            'block leading-5 break-words',
            done && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </span>
        {firstLine && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {firstLine}
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground empty:hidden">
          {children.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <GitForkIcon className="size-3" />
              {finished}/{children.length}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                !done && dueToneClass[tone],
              )}
            >
              {task.recurrence ? (
                <RepeatIcon className="size-3" />
              ) : (
                <CalendarIcon className="size-3" />
              )}
              {formatDue(task, today)}
            </span>
          )}
          {task.deadline && (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                !done && task.deadline < today && 'text-p1',
              )}
            >
              <TargetIcon className="size-3" />
              {formatDate(task.deadline, today)}
            </span>
          )}
          {(task.estimateMinutes !== null || task.trackedSeconds > 0) && (
            <span className="inline-flex items-center gap-1">
              <TimerIcon className="size-3" />
              {task.trackedSeconds > 0 && formatDuration(task.trackedSeconds)}
              {task.trackedSeconds > 0 &&
                task.estimateMinutes !== null &&
                ' / '}
              {task.estimateMinutes !== null &&
                formatEstimate(task.estimateMinutes)}
            </span>
          )}
          {taskLabels.map((label) => (
            <span key={label.id}>@{label.name}</span>
          ))}
          {showParent && parent && (
            <span className="truncate">↳ {parent.title}</span>
          )}
          {showPlacement && variant === 'row' && (
            <span className="ml-auto inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate">
                {project?.name ?? 'Inbox'}
                {section && ` / ${section.name}`}
              </span>
              <ProjectDot color={project?.color} />
            </span>
          )}
        </span>
      </button>

      {!done && (
        <div
          className={cn(
            'absolute right-0 flex items-center rounded-md bg-background opacity-0 group-focus-within/task:opacity-100 group-hover/task:opacity-100 has-[[data-state=open]]:opacity-100',
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
