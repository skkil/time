import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  type Id,
  type ItemStatus,
  type ItemType,
  type ItemTypeInput,
  type Milestone,
  type MilestoneInput,
  type Preset,
  type SavedView,
  type StatusInput,
  type ViewInput,
  commands,
} from '@/bindings';
import { useProjectIndex } from '@/features/projects/api';
import { keys } from '@/lib/query';
import type { DateKey } from '@/lib/time';

export const CATEGORIES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To do' },
  { value: 'active', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'dropped', label: 'Dropped' },
] as const;

export const isClosed = (category: string | null) =>
  category === 'done' || category === 'dropped';

export function useWorkflow() {
  return useQuery({ queryKey: keys.workflow, queryFn: commands.getWorkflow });
}

export function usePresets() {
  return useQuery({
    queryKey: keys.presets,
    queryFn: commands.listPresets,
    staleTime: Infinity,
  });
}

export type ProjectWorkflow = {
  types: ItemType[];
  statuses: ItemStatus[];
  milestones: Milestone[];
  views: SavedView[];
  milestoneLabel: string;
  preset: string;
  structured: boolean;
};

const EMPTY: ProjectWorkflow = {
  types: [],
  statuses: [],
  milestones: [],
  views: [],
  milestoneLabel: '',
  preset: 'simple',
  structured: false,
};

export function useProjectWorkflow(projectId: Id | null): ProjectWorkflow {
  const { data } = useWorkflow();
  const index = useProjectIndex();
  return useMemo(() => {
    const project = projectId === null ? undefined : index.byId.get(projectId);
    if (!project || !data) return EMPTY;
    const own = <T extends { projectId: Id }>(items: T[]) =>
      items.filter((item) => item.projectId === projectId);
    const result = {
      types: own(data.types),
      statuses: own(data.statuses),
      milestones: own(data.milestones),
      views: own(data.views),
      milestoneLabel: project.milestoneLabel,
      preset: project.preset,
    };
    return {
      ...result,
      structured:
        result.types.length + result.statuses.length + result.views.length >
          0 || result.milestoneLabel !== '',
    };
  }, [data, index, projectId]);
}

export function useWorkflowIndex() {
  const { data } = useWorkflow();
  return useMemo(
    () => ({
      types: new Map((data?.types ?? []).map((t) => [t.id, t])),
      statuses: new Map((data?.statuses ?? []).map((s) => [s.id, s])),
      milestones: new Map((data?.milestones ?? []).map((m) => [m.id, m])),
    }),
    [data],
  );
}

export function useEvents(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: keys.events(from, to),
    queryFn: () => commands.listEvents(from, to),
  });
}

export function useTypeTime(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: keys.typeTime(from, to),
    queryFn: () => commands.listTimeByType(from, to),
  });
}

function useWorkflowMutation<T, R = unknown>(run: (vars: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.workflow }),
        client.invalidateQueries({ queryKey: keys.projects }),
        client.invalidateQueries({ queryKey: keys.tasks }),
        client.invalidateQueries({ queryKey: keys.allEvents }),
        client.invalidateQueries({ queryKey: keys.review }),
        client.invalidateQueries({ queryKey: keys.timer }),
        client.invalidateQueries({ queryKey: keys.allEntries }),
      ]),
  });
}

export const useCreateType = () =>
  useWorkflowMutation(
    ({ projectId, input }: { projectId: Id; input: ItemTypeInput }) =>
      commands.createItemType(projectId, input),
  );
export const useUpdateType = () =>
  useWorkflowMutation(({ id, input }: { id: Id; input: ItemTypeInput }) =>
    commands.updateItemType(id, input),
  );
export const useDeleteType = () =>
  useWorkflowMutation(
    ({ id, replacement }: { id: Id; replacement: Id | null }) =>
      commands.deleteItemType(id, replacement),
  );
export const useCreateStatus = () =>
  useWorkflowMutation(
    ({ projectId, input }: { projectId: Id; input: StatusInput }) =>
      commands.createItemStatus(projectId, input),
  );
export const useUpdateStatus = () =>
  useWorkflowMutation(({ id, input }: { id: Id; input: StatusInput }) =>
    commands.updateItemStatus(id, input),
  );
export const useReorderStatus = () =>
  useWorkflowMutation(({ id, before }: { id: Id; before: Id | null }) =>
    commands.reorderItemStatus(id, before),
  );
export const useDeleteStatus = () =>
  useWorkflowMutation(
    ({ id, replacement }: { id: Id; replacement: Id | null }) =>
      commands.deleteItemStatus(id, replacement),
  );
export const useCreateMilestone = () =>
  useWorkflowMutation(
    ({ projectId, input }: { projectId: Id; input: MilestoneInput }) =>
      commands.createProjectMilestone(projectId, input),
  );
export const useUpdateMilestone = () =>
  useWorkflowMutation(({ id, input }: { id: Id; input: MilestoneInput }) =>
    commands.updateProjectMilestone(id, input),
  );
export const useDeleteMilestone = () =>
  useWorkflowMutation((id: Id) => commands.deleteProjectMilestone(id));
export const useSetMilestoneLabel = () =>
  useWorkflowMutation(({ id, label }: { id: Id; label: string }) =>
    commands.setProjectMilestoneLabel(id, label),
  );
export const useCreateView = () =>
  useWorkflowMutation(
    ({ projectId, input }: { projectId: Id; input: ViewInput }) =>
      commands.createSavedView(projectId, input),
  );
export const useUpdateView = () =>
  useWorkflowMutation(({ id, input }: { id: Id; input: ViewInput }) =>
    commands.updateSavedView(id, input),
  );
export const useDeleteView = () =>
  useWorkflowMutation((id: Id) => commands.deleteSavedView(id));
export const useApplyPreset = () =>
  useWorkflowMutation(({ id, preset }: { id: Id; preset: Preset }) =>
    commands.applyProjectPreset(id, preset),
  );
export const useSetTaskType = () =>
  useWorkflowMutation(({ id, typeId }: { id: Id; typeId: Id | null }) =>
    commands.setTaskTypeId(id, typeId),
  );
export const useSetTaskStatus = () =>
  useWorkflowMutation(({ id, statusId }: { id: Id; statusId: Id }) =>
    commands.setTaskStatusId(id, statusId),
  );
export const useSetTaskMilestone = () =>
  useWorkflowMutation(
    ({ id, milestoneId }: { id: Id; milestoneId: Id | null }) =>
      commands.setTaskMilestoneId(id, milestoneId),
  );
export const useSetTaskEvent = () =>
  useWorkflowMutation(
    ({
      id,
      location,
      countsAsTime,
    }: {
      id: Id;
      location: string;
      countsAsTime: boolean;
    }) => commands.setTaskEventDetails(id, location, countsAsTime),
  );

export function useSavePreset() {
  return useMutation({
    mutationFn: (id: Id) => commands.saveProjectPreset(id),
  });
}

export function useReadPreset() {
  return useMutation({
    mutationFn: (text: string) => commands.readPreset(text),
  });
}
