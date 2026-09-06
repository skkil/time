import type { TimeEntry } from '@/bindings';

export function useTimeByType(
  entries: TimeEntry[],
): { name: string; seconds: number }[] {
  return entries.length < 0 ? [] : [];
}
