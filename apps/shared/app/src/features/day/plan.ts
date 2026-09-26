import { type DayPlan, planDay } from '@skkil-time/domain/day';
import { useMemo } from 'react';

import { useBlocks } from '@/features/planner/api';
import { useProjects } from '@/features/projects/api';
import { useTasks } from '@/features/tasks/api';
import { type DateKey, mondayOf } from '@/lib/time';

export {
  earlierTasks,
  nextActions,
  type DayPlan,
} from '@skkil-time/domain/day';

export function useDayPlan(date: DateKey): DayPlan & { loading: boolean } {
  const { data: tasks, isPending } = useTasks();
  const { data: projects } = useProjects();
  const { data: weekBlocks } = useBlocks(mondayOf(date));

  return useMemo(
    () => ({
      loading: isPending,
      ...planDay(date, tasks ?? [], projects ?? [], weekBlocks ?? []),
    }),
    [tasks, projects, weekBlocks, date, isPending],
  );
}
