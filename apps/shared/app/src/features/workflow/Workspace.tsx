import { type ReactNode, useMemo } from 'react';

import type { Project, SavedView, Section, Task } from '@/backend';
import { todayKey } from '@/lib/time';

import { BoardView } from './BoardView';
import { CalendarView } from './CalendarView';
import { GroupedList } from './GroupedList';
import { TableView } from './TableView';
import { type ProjectWorkflow, isClosed } from './api';
import { filterTasks, groupTasks, sortTasks, specOf } from './views';

export function Workspace({
  project,
  workflow,
  view,
  own,
  sections,
  sectionList,
}: {
  project: Project;
  workflow: ProjectWorkflow;
  view: SavedView;
  own: Task[];
  sections: Section[];
  sectionList: ReactNode;
}) {
  const spec = specOf(view);

  const tasks = useMemo(
    () => sortTasks(filterTasks(own, spec), spec.sort),
    [own, spec],
  );
  const groupBy =
    spec.layout === 'board' && spec.groupBy === 'none'
      ? 'status'
      : spec.groupBy;
  const groups = groupTasks(
    tasks,
    groupBy,
    { ...workflow, sections },
    todayKey(),
  ).filter(
    (group) =>
      !(spec.filter.hideBacklog && group.category === 'backlog') &&
      !(spec.filter.hideDone && isClosed(group.category ?? null)),
  );

  return spec.layout === 'board' ? (
    <BoardView
      groups={groups}
      projectId={project.id}
      archived={project.archived}
      showAge={workflow.preset === 'pipeline'}
    />
  ) : spec.layout === 'calendar' ? (
    <CalendarView
      projectId={project.id}
      tasks={own.filter((task) => task.parentId === null)}
    />
  ) : spec.layout === 'table' ? (
    <TableView tasks={tasks} workflow={workflow} sort={spec.sort} />
  ) : spec.groupBy === 'section' && Object.keys(spec.filter).length === 0 ? (
    sectionList
  ) : (
    <div className="min-h-0 flex-1 overflow-y-auto px-10 py-6">
      <GroupedList
        groups={groups}
        projectId={project.id}
        archived={project.archived}
      />
    </div>
  );
}
