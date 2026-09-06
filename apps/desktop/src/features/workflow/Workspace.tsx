import { PlusIcon, SlidersHorizontalIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import type { Id, Project, SavedView, Section, Task } from '@/bindings';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTaskIndex } from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import { setPreference, usePreference } from '@/lib/preferences';
import { formatHours, mondayOf, shiftKey, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { BoardView } from './BoardView';
import { CalendarView } from './CalendarView';
import { GroupedList } from './GroupedList';
import { TableView } from './TableView';
import { ViewEditor } from './ViewEditor';
import { isClosed, useProjectWorkflow, useWorkflowIndex } from './api';
import { filterTasks, groupTasks, sortTasks, specOf } from './views';

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

export function Workspace({
  project,
  own,
  sections,
  sectionList,
}: {
  project: Project;
  own: Task[];
  sections: Section[];
  sectionList: ReactNode;
}) {
  const workflow = useProjectWorkflow(project.id);
  const lastViews = usePreference('lastViews');
  const views = workflow.views.length > 0 ? workflow.views : [DEFAULT_VIEW];
  const view =
    views.find((item) => item.id === lastViews[project.id]) ?? views[0];
  const spec = specOf(view);
  const choose = (id: Id) =>
    setPreference('lastViews', { ...lastViews, [project.id]: id });

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

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 px-8 pt-5">
        <nav aria-label="Views" className="flex flex-wrap gap-1">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === view.id ? 'page' : undefined}
              onClick={() => choose(item.id)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm transition-colors',
                item.id === view.id
                  ? 'bg-white/[.12] text-foreground'
                  : 'text-foreground/55 hover:text-foreground',
              )}
            >
              {item.name}
            </button>
          ))}
        </nav>
        {view.id > 0 && (
          <EditorPopover
            label={`Edit ${view.name}`}
            icon={<SlidersHorizontalIcon className="size-3.5" />}
          >
            {(close) => (
              <ViewEditor
                projectId={project.id}
                workflow={workflow}
                view={view}
                onDone={close}
              />
            )}
          </EditorPopover>
        )}
        <EditorPopover
          label="New view"
          icon={<PlusIcon className="size-3.5" />}
        >
          {(close) => (
            <ViewEditor
              projectId={project.id}
              workflow={workflow}
              onDone={(id) => {
                if (id !== undefined) choose(id);
                close();
              }}
            />
          )}
        </EditorPopover>
        <TypeTime projectId={project.id} />
      </div>

      {spec.layout === 'board' ? (
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
      ) : spec.groupBy === 'section' &&
        Object.keys(spec.filter).length === 0 ? (
        sectionList
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <GroupedList
            groups={groups}
            projectId={project.id}
            archived={project.archived}
          />
        </div>
      )}
    </>
  );
}

function EditorPopover({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="grid size-8 place-items-center rounded-full text-foreground/50 hover:bg-white/10 hover:text-foreground"
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-5">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

function TypeTime({ projectId }: { projectId: Id }) {
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
  if (totals.size === 0) return null;
  return (
    <p className="ml-auto text-xs text-foreground/50 tabular-nums">
      This week:{' '}
      {[...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, seconds]) => `${name} ${formatHours(seconds)} h`)
        .join(' · ')}
    </p>
  );
}
