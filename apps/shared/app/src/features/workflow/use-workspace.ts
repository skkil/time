import type { Id, SavedView } from '@/backend';
import { useTaskIndex } from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import { setPreference, usePreference } from '@/lib/preferences';
import { mondayOf, shiftKey, todayKey } from '@/lib/time';

import { useProjectWorkflow, useWorkflowIndex } from './api';

const DEFAULT_VIEW: SavedView = {
  id: -1,
  projectId: -1,
  name: 'List',
  layout: 'list',
  groupBy: 'section',
  filter: '{}',
  sort: 'manual',
  position: 0,
};

export function useWorkspaceView(projectId: Id | null) {
  const workflow = useProjectWorkflow(projectId);
  const lastViews = usePreference('lastViews');
  const views = workflow.views.length > 0 ? workflow.views : [DEFAULT_VIEW];
  const view =
    views.find(
      (item) => projectId !== null && item.id === lastViews[projectId],
    ) ?? views[0];
  const choose = (id: Id) => {
    if (projectId !== null)
      setPreference('lastViews', { ...lastViews, [projectId]: id });
  };
  return { workflow, views, view, choose };
}

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
