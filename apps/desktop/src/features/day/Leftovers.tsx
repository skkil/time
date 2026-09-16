import type { Task } from '@/bindings';
import { Button } from '@/components/ui/button';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectLink } from '@/features/projects/ProjectLink';
import { useProjectIndex } from '@/features/projects/api';
import { TaskLink } from '@/features/tasks/TaskLink';
import {
  useDeleteTasks,
  useRescheduleTasks,
  useSetTasksSomeday,
} from '@/features/tasks/api';
import { formatDate } from '@/features/tasks/meta';
import { type DateKey, shiftKey, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

export function Leftovers({
  tasks,
  target,
  targetLabel,
  className,
}: {
  tasks: Task[];
  target: DateKey;
  targetLabel?: string;
  className?: string;
}) {
  const reschedule = useRescheduleTasks();
  const someday = useSetTasksSomeday();
  const drop = useDeleteTasks();
  const index = useProjectIndex();
  const today = todayKey();
  const ids = tasks.map((task) => task.id);
  const label = targetLabel ?? (target === today ? 'Today' : 'Tomorrow');
  const later = shiftKey(target, 1);

  if (tasks.length === 0)
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Nothing here. Clean slate.
      </p>
    );

  return (
    <div className={cn('grid gap-3', className)}>
      <ul className="grid divide-y rounded-lg border bg-card">
        {tasks.map((task) => {
          const project =
            task.projectId === null
              ? undefined
              : index.byId.get(task.projectId);
          return (
            <li key={task.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <TaskLink taskId={task.id} className="block truncate text-sm">
                  {task.title}
                </TaskLink>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ProjectLink
                    projectId={task.projectId}
                    className="flex items-center gap-2"
                  >
                    <ProjectDot color={project?.color} />
                    {project?.name ?? 'Inbox'}
                  </ProjectLink>
                  {task.dueDate && (
                    <span>· {formatDate(task.dueDate, today)}</span>
                  )}
                  {task.rolloverCount >= 2 && (
                    <span>· moved ×{task.rolloverCount}</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    reschedule.mutate({ ids: [task.id], dueDate: target })
                  }
                >
                  {label}
                </Button>
                {!targetLabel && (
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      reschedule.mutate({ ids: [task.id], dueDate: later })
                    }
                  >
                    {target === today ? 'Tomorrow' : 'Day after'}
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    someday.mutate({ ids: [task.id], someday: true })
                  }
                >
                  Someday
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => drop.mutate([task.id])}
                >
                  Drop
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {tasks.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          All {tasks.length}:
          <Button
            size="xs"
            variant="outline"
            onClick={() => reschedule.mutate({ ids, dueDate: target })}
          >
            {label}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => someday.mutate({ ids, someday: true })}
          >
            Someday
          </Button>
        </div>
      )}
    </div>
  );
}
