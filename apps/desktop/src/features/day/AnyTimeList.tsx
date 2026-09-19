import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import type { Id, Task } from '@/bindings';
import { PriorityCheck } from '@/features/tasks/PriorityCheck';
import { useSetTaskCompleted } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

const LINGER_MS = 4000;
const VISIBLE_ROWS = 4;

type Lingering = { task: Task; at: number };

export function AnyTimeList({
  tasks,
  finished,
  openId,
  runningId,
  onPick,
}: {
  tasks: Task[];
  finished: Task[];
  openId: Id | null;
  runningId: Id | null;
  onPick: (id: Id) => void;
}) {
  const { newTask } = useTaskDialog();
  const complete = useSetTaskCompleted();
  const [lingering, setLingering] = useState<Lingering[]>([]);
  const [showFinished, setShowFinished] = useState(false);

  const lingers = new Set(lingering.map(({ task }) => task.id));
  const rows = tasks
    .filter((task) => !lingers.has(task.id))
    .map((task) => ({ task, done: false }));
  for (const { task, at } of lingering)
    rows.splice(at, 0, { task, done: true });
  const earlier = finished.filter((task) => !lingers.has(task.id));
  if (showFinished) rows.push(...earlier.map((task) => ({ task, done: true })));

  const stopLingering = (id: Id) =>
    setLingering((current) => current.filter((entry) => entry.task.id !== id));

  const reopen = (id: Id) => {
    complete.mutate({ id, completed: false });
    stopLingering(id);
  };

  const finish = (task: Task, at: number) => {
    complete.mutate({ id: task.id, completed: true });
    if (task.recurrence) return;
    setLingering((current) => [...current, { task, at }]);
    setTimeout(() => stopLingering(task.id), LINGER_MS);
  };

  return (
    <div className="shrink-0 pt-4 pb-3">
      {rows.length > 0 && (
        <p className="pb-1 text-xs text-foreground/60">
          Any time today
          {tasks.length > VISIBLE_ROWS && ` · ${tasks.length}`}
        </p>
      )}
      <ul
        className="no-scrollbar snap-y snap-mandatory overflow-y-auto"
        style={{ maxHeight: `${VISIBLE_ROWS * 2}rem` }}
      >
        {rows.map(({ task, done }, at) => {
          const open = task.id === openId;
          const live = task.id === runningId;
          return (
            <li
              key={task.id}
              className="flex h-8 snap-start items-center gap-3"
            >
              <PriorityCheck
                priority={task.priority}
                checked={done}
                label={`Mark ${task.title} ${done ? 'not done' : 'done'}`}
                onToggle={() => (done ? reopen(task.id) : finish(task, at))}
                className={cn(
                  'size-[15px] [&_svg]:size-2.5',
                  !done && (live || open) && 'border-white bg-white/25',
                )}
              />
              <button
                type="button"
                onClick={() => onPick(task.id)}
                aria-current={open ? 'true' : undefined}
                className={cn(
                  'min-w-0 truncate text-left text-sm transition-colors duration-500 outline-none hover:text-foreground focus-visible:underline',
                  done
                    ? 'text-foreground/40 line-through'
                    : open
                      ? 'text-foreground'
                      : 'text-foreground/75',
                )}
              >
                {task.title}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-4 pt-1.5 text-sm text-foreground/60">
        <button
          type="button"
          onClick={() => newTask({ dueDate: todayKey() })}
          className="flex items-center gap-2 transition-colors hover:text-foreground"
        >
          <PlusIcon className="size-4" strokeWidth={1.5} />
          Add
        </button>
        {earlier.length > 0 && (
          <button
            type="button"
            aria-expanded={showFinished}
            onClick={() => setShowFinished(!showFinished)}
            className="transition-colors hover:text-foreground"
          >
            {earlier.length} done today
          </button>
        )}
      </div>
    </div>
  );
}
