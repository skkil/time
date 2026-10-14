import { useQuery } from '@tanstack/react-query';

import { commands } from '@/core/api/client';
import { keys } from '@/core/api/query-client';

export const useProjects = () =>
  useQuery({ queryKey: keys.projects, queryFn: commands.listProjects });

export const useSections = () =>
  useQuery({ queryKey: keys.sections, queryFn: commands.listSections });
