import type { Id } from '@skkil-time/client/types';
import { useQuery } from '@tanstack/react-query';

import { keys } from '@/core/api/query-client';
import { commands } from '@/core/local/backend';

export const useProjects = () =>
  useQuery({ queryKey: keys.projects, queryFn: commands.listProjects });

export const useSections = () =>
  useQuery({ queryKey: keys.sections, queryFn: commands.listSections });

export const useGroups = () =>
  useQuery({ queryKey: ['groups'], queryFn: commands.listGroups });

export const useCanvas = (projectId: Id | null) =>
  useQuery({
    queryKey: ['canvas', projectId],
    queryFn: () => commands.getProjectCanvas(projectId!),
    enabled: projectId !== null,
  });
