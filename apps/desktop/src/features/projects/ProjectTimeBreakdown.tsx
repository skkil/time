import { useMemo } from 'react';

import type { Id } from '@/bindings';
import { formatDuration } from '@/lib/time';

import { ProjectDot } from './ProjectDot';
import { useProjectIndex } from './api';
import { type ProjectTotal, projectColorVar, rollUpSeconds } from './tree';

export function ProjectTimeBreakdown({
  spans,
  emptyText = 'No time tracked.',
}: {
  spans: { projectId: Id | null; seconds: number }[];
  emptyText?: string;
}) {
  const index = useProjectIndex();
  const totals = useMemo(() => {
    const byProject = new Map<Id | null, number>();
    for (const span of spans) {
      byProject.set(
        span.projectId,
        (byProject.get(span.projectId) ?? 0) + span.seconds,
      );
    }
    return rollUpSeconds(index, byProject);
  }, [index, spans]);

  const grand = totals.reduce((sum, entry) => sum + entry.total, 0);
  if (grand === 0)
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  const rows: { entry: ProjectTotal; depth: number }[] = [];
  const walk = (entry: ProjectTotal, depth: number) => {
    rows.push({ entry, depth });
    entry.children.forEach((child) => walk(child, depth + 1));
  };
  totals.forEach((entry) => walk(entry, 0));

  return (
    <ul className="grid gap-2.5">
      {rows.map(({ entry, depth }) => {
        const share = entry.total / grand;
        return (
          <li
            key={entry.node?.id ?? 'none'}
            className="grid gap-1"
            style={{ paddingLeft: depth * 14 }}
          >
            <div className="flex items-center gap-2 text-sm">
              <ProjectDot color={entry.node?.color} />
              <span
                className={depth === 0 ? 'truncate font-medium' : 'truncate'}
              >
                {entry.node?.name ?? 'No project'}
              </span>
              <span className="ml-auto text-xs">
                {formatDuration(entry.total)}
              </span>
              <span className="w-9 text-right text-xs text-muted-foreground">
                {Math.round(share * 100)}%
              </span>
            </div>
            {depth === 0 && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(share * 100, 1)}%`,
                    background: entry.node
                      ? projectColorVar(entry.node.color)
                      : 'var(--muted-foreground)',
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
