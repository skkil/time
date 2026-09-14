import { useMemo } from 'react';

import type { Project, ProjectSettings } from '@/bindings';
import { SectionTitle } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Leftovers } from '@/features/day/Leftovers';
import { ProjectDot } from '@/features/projects/ProjectDot';
import {
  isDueForReview,
  settingsOf,
  useMarkProjectReviewed,
  useProjects,
  useUpdateProjectSettings,
} from '@/features/projects/api';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { type DateKey, nowSeconds, shiftKey, todayKey } from '@/lib/time';

const STALE_DAYS = 14;
const STALE_ROLLOVERS = 3;

export function ClearDeck({ nextMonday }: { nextMonday: DateKey }) {
  const { data: tasks } = useTasks();
  const { data: projects } = useProjects();
  const today = todayKey();

  const { inbox, stale, dueProjects, openCounts } = useMemo(() => {
    const open = (tasks ?? []).filter(
      (task) =>
        task.completedAt === null && !task.someday && task.kind === 'task',
    );
    const counts = new Map<number, number>();
    for (const task of open)
      if (task.projectId !== null)
        counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
    const cutoff = shiftKey(today, -STALE_DAYS);
    return {
      inbox: open.filter(
        (task) =>
          task.projectId === null &&
          task.parentId === null &&
          task.dueDate === null &&
          task.mustOn === null,
      ),
      stale: open.filter(
        (task) =>
          task.statusCategory !== 'backlog' &&
          (task.rolloverCount >= STALE_ROLLOVERS ||
            (task.dueDate !== null && task.dueDate < cutoff)),
      ),
      dueProjects: (projects ?? []).filter((project) =>
        isDueForReview(project, nowSeconds()),
      ),
      openCounts: counts,
    };
  }, [tasks, projects, today]);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="deck-inbox" className="grid gap-2">
        <SectionTitle aside={String(inbox.length)}>
          <span id="deck-inbox">Inbox</span>
        </SectionTitle>
        <p className="text-sm text-muted-foreground">
          Give each a week, park it, or let it go. Open one to file it into a
          project.
        </p>
        <Leftovers tasks={inbox} target={nextMonday} targetLabel="Next week" />
      </section>

      <section aria-labelledby="deck-stale" className="grid gap-2">
        <SectionTitle aside={String(stale.length)}>
          <span id="deck-stale">Going stale</span>
        </SectionTitle>
        <p className="text-sm text-muted-foreground">
          Moved {STALE_ROLLOVERS}+ times or overdue more than {STALE_DAYS} days.
          Tasks that wait this long rarely get done as they are.
        </p>
        <Leftovers tasks={stale} target={nextMonday} targetLabel="Next week" />
      </section>

      <section aria-labelledby="deck-projects" className="grid gap-2">
        <SectionTitle aside={String(dueProjects.length)}>
          <span id="deck-projects">Projects due for a look</span>
        </SectionTitle>
        {dueProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every active project has been looked at recently.
          </p>
        ) : (
          <ul className="grid divide-y rounded-lg border bg-card">
            {dueProjects.map((project) => (
              <ProjectCheck
                key={project.id}
                project={project}
                openTasks={openCounts.get(project.id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProjectCheck({
  project,
  openTasks,
}: {
  project: Project;
  openTasks: number;
}) {
  const reviewed = useMarkProjectReviewed();
  const update = useUpdateProjectSettings();
  const { newTask } = useTaskDialog();
  const set = (patch: Partial<ProjectSettings>) =>
    update.mutate(
      { id: project.id, settings: { ...settingsOf(project), ...patch } },
      { onSuccess: () => reviewed.mutate(project.id) },
    );

  return (
    <li className="grid gap-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <ProjectDot color={project.color} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {project.name}
        </span>
        <span className="text-xs text-muted-foreground">{openTasks} open</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          size="xs"
          variant="outline"
          onClick={() => reviewed.mutate(project.id)}
        >
          Continue
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => set({ status: 'paused' })}
        >
          Pause
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => set({ status: 'done' })}
        >
          Close as done
        </Button>
        <Button
          size="xs"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => set({ status: 'dropped' })}
        >
          Drop
        </Button>
        {openTasks === 0 && (
          <Button
            size="xs"
            variant="link"
            className="ml-auto"
            onClick={() => newTask({ projectId: project.id })}
          >
            Add a next action
          </Button>
        )}
      </div>
    </li>
  );
}
