import { useQuery } from '@tanstack/react-query';

import { keys } from '@/core/api/query-client';
import { commands } from '@/core/local/backend';

export const useProjects = () =>
  useQuery({ queryKey: keys.projects, queryFn: commands.listProjects });

export const useSections = () =>
  useQuery({ queryKey: keys.sections, queryFn: commands.listSections });
