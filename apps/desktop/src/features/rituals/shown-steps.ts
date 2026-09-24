import { useDueHabits } from '@/features/habits/api';
import type { DateKey } from '@/lib/time';

export function useShownSteps<T extends string>(steps: T[], date: DateKey) {
  const { due } = useDueHabits(date);
  const noHabits = due !== undefined && due.length === 0;
  return steps.filter((step) => !(noHabits && step === 'habit_check'));
}
