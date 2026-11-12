import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  type Id,
  type Project,
  type ProjectInput,
  type ProjectSettings,
  commands,
} from '@/backend';
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

export function useReorderProject() {
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, before }: { id: Id; before: Id | null }) =>
      commands.reorderProject(id, before),
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

export const settingsOf = (project: Project): ProjectSettings => ({
  groupId: project.groupId,
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

export function useSaveProject(id: Id) {
  const client = useQueryClient();
  const update = useUpdateProject();
  const updateSettings = useUpdateProjectSettings();
  const current = () =>
    client
      .getQueryData<Project[]>(keys.projects)
      ?.find((project) => project.id === id);
  const patchCache = (patch: Partial<Project>) =>
    client.setQueryData<Project[]>(keys.projects, (projects) =>
      projects?.map((project) =>
        project.id === id ? { ...project, ...patch } : project,
      ),
    );
  const refetch = () => client.invalidateQueries({ queryKey: keys.projects });

  return {
    project: (patch: Partial<ProjectInput>) => {
      const project = current();
      if (!project) return;
      const input: ProjectInput = {
        name: project.name,
        parentId: project.parentId,
        color: project.color,
        ...patch,
      };
      patchCache(input);
      update.mutate({ id, input }, { onError: refetch });
    },
    settings: (patch: Partial<ProjectSettings>) => {
      const project = current();
      if (!project) return;
      const settings = { ...settingsOf(project), ...patch };
      patchCache(settings);
      updateSettings.mutate({ id, settings }, { onError: refetch });
    },
  };
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
