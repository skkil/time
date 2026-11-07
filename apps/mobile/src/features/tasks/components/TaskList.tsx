import type { Id, Project, Task } from '@skkil-time/contract';

import { TaskRow } from '@/features/tasks/components/TaskRow';
import { Group } from '@/ui/Group';

export function TaskList({
  title,
  tasks,
  projects,
  trailing,
}: {
  title?: string;
  tasks: Task[];
  projects: Map<Id, Project>;
  trailing?: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <Group title={title} trailing={trailing}>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          project={
            task.projectId === null ? undefined : projects.get(task.projectId)
          }
        />
      ))}
    </Group>
  );
}
