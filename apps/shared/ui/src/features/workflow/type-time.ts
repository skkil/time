import type { Id } from '@/backend';
import { useTaskIndex } from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import { mondayOf, shiftKey, todayKey } from '@/lib/time';

import { useWorkflowIndex } from './api';

export function useProjectTypeTime(projectId: Id | null) {
  const week = mondayOf(todayKey());
  const { data: entries = [] } = useTimeEntries(week, shiftKey(week, 7));
  const tasks = useTaskIndex();
  const types = useWorkflowIndex().types;
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const task =
      entry.taskId === null ? undefined : tasks.byId.get(entry.taskId);
    if (!task || task.projectId !== projectId || task.typeId === null) continue;
    const name = types.get(task.typeId)?.name;
    if (name)
      totals.set(
        name,
        (totals.get(name) ?? 0) + entry.endedAt - entry.startedAt,
      );
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}
