import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  type Id,
  type Project,
  type ProjectInput,
  type ProjectSettings,
  commands,
} from '@/bindings';
import { keys } from '@/lib/query';

import { buildProjectIndex } from './tree';

export function useProjects() {
  return useQuery({ queryKey: keys.projects, queryFn: commands.listProjects });
}

export function useProjectIndex() {
  const { data } = useProjects();
  return useMemo(() => buildProjectIndex(data ?? []), [data]);
}

function useInvalidateProjects() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.projects }),
      client.invalidateQueries({ queryKey: keys.tasks }),
      client.invalidateQueries({ queryKey: keys.allBlocks }),
    ]);
}

export function useCreateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: ProjectInput) => commands.createProject(input),
    onSuccess: invalidate,
  });
}

export function useUpdateProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: ProjectInput }) =>
      commands.updateProject(id, input),
    onSuccess: invalidate,
  });
}

export function useArchiveProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, archived }: { id: Id; archived: boolean }) =>
      commands.setProjectArchived(id, archived),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: Id) => commands.deleteProject(id),
    onSuccess: () =>
      Promise.all([
        invalidate(),
        client.invalidateQueries({ queryKey: keys.allEntries }),
      ]),
  });
}

export function useSetProjectView() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, view }: { id: Id; view: string }) =>
      commands.setProjectView(id, view),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.projects }),
  });
}

export const settingsOf = (project: Project): ProjectSettings => ({
  kind: project.kind,
  status: project.status,
  outcome: project.outcome,
  weeklyMinutes: project.weeklyMinutes,
  targetDate: project.targetDate,
  killCriteria: project.killCriteria,
  reviewEveryWeeks: project.reviewEveryWeeks,
  inOrder: project.inOrder,
});

export function useUpdateProjectSettings() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, settings }: { id: Id; settings: ProjectSettings }) =>
      commands.updateProjectSettings(id, settings),
    onSuccess: invalidate,
  });
}

export function useMarkProjectReviewed() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => commands.markProjectReviewed(id),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.projects }),
  });
}

const WEEK_SECONDS = 7 * 24 * 3600;

export function isDueForReview(project: Project, now: number) {
  if (project.archived || project.status !== 'active') return false;
  if (project.lastReviewedAt === null) return true;
  return (
    now - project.lastReviewedAt >= project.reviewEveryWeeks * WEEK_SECONDS
  );
}
