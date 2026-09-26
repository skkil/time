import { ArrowDownIcon } from 'lucide-react';
import { useState } from 'react';

import type { Task } from '@/backend';
import { TABLE_SURFACE } from '@/components/surfaces';
import { formatDate, formatDue } from '@/features/tasks/meta';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { formatDuration, formatEstimate, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

import { TypeIcon } from './TypeIcon';
import type { ProjectWorkflow } from './api';
import { sortTasks } from './views';

const COLUMNS = [
  { key: 'title', label: 'Name', sort: 'title' },
  { key: 'type', label: 'Type', sort: null },
  { key: 'status', label: 'Status', sort: null },
  { key: 'milestone', label: 'Milestone', sort: null },
  { key: 'date', label: 'Date', sort: 'date' },
  { key: 'deadline', label: 'Deadline', sort: 'deadline' },
  { key: 'estimate', label: 'Estimate', sort: null },
  { key: 'tracked', label: 'Focused', sort: null },
] as const;

export function TableView({
  tasks,
  workflow,
  sort: initialSort,
}: {
  tasks: Task[];
  workflow: ProjectWorkflow;
  sort: string;
}) {
  const { openTask } = useTaskDialog();
  const [sort, setSort] = useState(initialSort);
  const today = todayKey();
  const columns = COLUMNS.filter(
    (column) =>
      (column.key !== 'type' || workflow.types.length > 0) &&
      (column.key !== 'status' || workflow.statuses.length > 0) &&
      (column.key !== 'milestone' || workflow.milestoneLabel !== ''),
  );
  const rows = sortTasks(tasks, sort);

  const cell = (task: Task, key: (typeof COLUMNS)[number]['key']) => {
    switch (key) {
      case 'title':
        return task.title;
      case 'type': {
        const type = workflow.types.find((t) => t.id === task.typeId);
        return (
          type && (
            <span className="flex items-center gap-1.5">
              <TypeIcon icon={type.icon} />
              {type.name}
            </span>
          )
        );
      }
      case 'status':
        return workflow.statuses.find((s) => s.id === task.statusId)?.name;
      case 'milestone':
        return workflow.milestones.find((m) => m.id === task.milestoneId)?.name;
      case 'date':
        return task.dueDate && formatDue(task, today);
      case 'deadline':
        return task.deadline && formatDate(task.deadline, today);
      case 'estimate':
        return task.estimateMinutes && formatEstimate(task.estimateMinutes);
      case 'tracked':
        return task.trackedSeconds > 0 && formatDuration(task.trackedSeconds);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto px-10 py-4">
      <table
        className={cn(
          TABLE_SURFACE,
          'w-full border-separate border-spacing-0 overflow-hidden text-sm',
        )}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={column.sort === sort ? 'ascending' : undefined}
                className="border-b border-white/[.07] px-3 py-2.5 text-left text-xs font-normal text-foreground/75"
              >
                {column.sort ? (
                  <button
                    type="button"
                    onClick={() => setSort(column.sort!)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {column.label}
                    {column.sort === sort && (
                      <ArrowDownIcon className="size-3" />
                    )}
                  </button>
                ) : column.key === 'milestone' ? (
                  workflow.milestoneLabel
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => (
            <tr
              key={task.id}
              onClick={() => openTask(task.id)}
              className="cursor-pointer hover:bg-white/[.05]"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'border-b border-white/[.04] px-3 py-2 text-foreground/70',
                    column.key === 'title' && 'text-foreground',
                    task.completedAt !== null &&
                      column.key === 'title' &&
                      'text-foreground/75 line-through',
                  )}
                >
                  {cell(task, column.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
