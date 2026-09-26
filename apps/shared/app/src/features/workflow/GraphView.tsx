import { useMemo, useState } from 'react';

import type { Id, Task } from '@/backend';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { PriorityCheck } from '@/features/tasks/PriorityCheck';
import { useSetTaskCompleted, useTaskIndex } from '@/features/tasks/api';
import { formatDue } from '@/features/tasks/meta';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { cn } from '@/lib/utils';

import { dependencyGraph } from './graph';

const NODE_W = 232;
const NODE_H = 64;
const GAP_X = 72;
const GAP_Y = 20;

export function GraphView({
  projectId,
  own,
}: {
  projectId: Id | null;
  own: Task[];
}) {
  const tasks = useTaskIndex();
  const { columns, edges } = useMemo(
    () => dependencyGraph(own, tasks.byId, tasks.holding),
    [own, tasks],
  );
  const [hovered, setHovered] = useState<Id | null>(null);

  const tallest = Math.max(...columns.map((column) => column.length));
  const place = new Map<Id, { x: number; y: number }>();
  columns.forEach((column, i) => {
    const offset = ((tallest - column.length) * (NODE_H + GAP_Y)) / 2;
    column.forEach((task, row) =>
      place.set(task.id, {
        x: i * (NODE_W + GAP_X),
        y: offset + row * (NODE_H + GAP_Y),
      }),
    );
  });
  const width = columns.length * (NODE_W + GAP_X) - GAP_X;
  const height = tallest * (NODE_H + GAP_Y) - GAP_Y;
  const unlinked = own.filter(
    (task) =>
      task.completedAt === null &&
      task.parentId === null &&
      !place.has(task.id),
  ).length;

  return (
    <div className="min-h-0 flex-1 overflow-auto px-10 py-6">
      {unlinked > 0 && (
        <p className="mb-6 text-sm text-foreground/75">
          {unlinked} {unlinked === 1 ? 'task has' : 'tasks have'} no links and
          {unlinked === 1 ? ' isn’t' : ' aren’t'} shown.
        </p>
      )}
      <div className="relative" style={{ width, height }}>
        <svg
          aria-hidden
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0 overflow-visible"
        >
          <defs>
            {['dim', 'lit'].map((tone) => (
              <marker
                key={tone}
                id={`arrow-${tone}`}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="8"
                markerHeight="8"
                orient="auto"
              >
                <path
                  d="M0,0 L8,4 L0,8 z"
                  className={tone === 'lit' ? 'fill-white/80' : 'fill-white/40'}
                />
              </marker>
            ))}
          </defs>
          {edges.map(({ from, to }) => {
            const a = place.get(from)!;
            const b = place.get(to)!;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const bend = GAP_X / 2;
            const lit = hovered === from || hovered === to;
            const settled = tasks.byId.get(from)?.completedAt != null;
            return (
              <path
                key={`${from}-${to}`}
                d={`M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`}
                fill="none"
                strokeWidth={lit ? 1.5 : 1}
                strokeDasharray={settled ? '3 4' : undefined}
                markerEnd={`url(#arrow-${lit ? 'lit' : 'dim'})`}
                className={cn(
                  'transition-[stroke] duration-300',
                  lit ? 'stroke-white/80' : 'stroke-white/40',
                )}
              />
            );
          })}
        </svg>
        {columns.flat().map((task) => (
          <GraphNode
            key={task.id}
            task={task}
            projectId={projectId}
            position={place.get(task.id)!}
            onHover={setHovered}
          />
        ))}
      </div>
    </div>
  );
}

function GraphNode({
  task,
  projectId,
  position,
  onHover,
}: {
  task: Task;
  projectId: Id | null;
  position: { x: number; y: number };
  onHover: (id: Id | null) => void;
}) {
  const index = useProjectIndex();
  const complete = useSetTaskCompleted();
  const { openTask } = useTaskDialog();
  const done = task.completedAt !== null;
  const waiting = !done && task.waitingOn.length > 0;
  const elsewhere =
    task.projectId !== projectId
      ? task.projectId === null
        ? undefined
        : index.byId.get(task.projectId)
      : undefined;
  const meta = elsewhere
    ? elsewhere.name
    : task.projectId !== projectId
      ? 'Inbox'
      : waiting
        ? `Waiting on ${task.waitingOn.length} ${task.waitingOn.length === 1 ? 'task' : 'tasks'}`
        : task.dueDate
          ? formatDue(task)
          : null;

  return (
    <div
      onPointerEnter={() => onHover(task.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(task.id)}
      onBlur={() => onHover(null)}
      className={cn(
        'absolute flex items-start gap-2.5 rounded-2xl px-3 py-2.5 ring-1 backdrop-blur-md transition-colors duration-300',
        done
          ? 'bg-white/[.03] ring-white/[.06]'
          : waiting
            ? 'bg-white/[.05] ring-white/10'
            : 'bg-white/[.09] ring-white/20 hover:bg-white/[.12]',
      )}
      style={{
        left: position.x,
        top: position.y,
        width: NODE_W,
        height: NODE_H,
      }}
    >
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
        className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <span
          className={cn(
            'line-clamp-1 text-sm',
            done && 'text-foreground/75 line-through',
            waiting && 'text-foreground/75',
          )}
        >
          {task.title}
        </span>
        {meta && (
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-foreground/75">
            {elsewhere && <ProjectDot color={elsewhere.color} />}
            {meta}
          </span>
        )}
      </button>
    </div>
  );
}
