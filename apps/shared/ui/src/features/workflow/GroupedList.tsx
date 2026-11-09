import { PlusIcon } from 'lucide-react';

import type { Id } from '@/backend';
import { TaskItem } from '@/features/tasks/TaskItem';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';

import { TypeIcon } from './TypeIcon';
import { type Group, groupDefaults } from './views';

export function GroupedList({
  groups,
  projectId,
  archived,
}: {
  groups: Group[];
  projectId: Id;
  archived: boolean;
}) {
  const { newTask } = useTaskDialog();
  const shown = groups.filter(
    (group) => group.tasks.length > 0 || groups.length === 1,
  );
  return (
    <div className="mx-auto grid max-w-3xl gap-8 sm:pl-10">
      {shown.map((group) => (
        <section key={group.key} aria-label={group.label}>
          {groups.length > 1 && (
            <h2 className="mb-1 flex items-center gap-2 text-xs tracking-wide text-foreground/75">
              {group.icon && <TypeIcon icon={group.icon} />}
              {group.label}
              <span className="text-foreground/30">{group.tasks.length}</span>
            </h2>
          )}
          <ul>
            {group.tasks.map((task) => (
              <li key={task.id}>
                <TaskItem task={task} />
              </li>
            ))}
          </ul>
          {!archived && (
            <button
              type="button"
              onClick={() => newTask(groupDefaults(group, projectId))}
              className="mt-1 flex h-8 items-center gap-2.5 text-sm text-foreground/75 hover:text-foreground"
            >
              <PlusIcon className="size-4" strokeWidth={1.5} />
              Add
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
