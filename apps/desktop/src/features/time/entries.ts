import type { TrackedEntry } from '@/bindings';
import { type DateKey, dateKeyOf } from '@/lib/time';

export const entrySeconds = (entry: TrackedEntry) =>
  entry.endedAt - entry.startedAt;

export const totalSeconds = (entries: TrackedEntry[]) =>
  entries.reduce((sum, entry) => sum + entrySeconds(entry), 0);

export const sessionCount = (count: number) =>
  `${count} ${count === 1 ? 'session' : 'sessions'}`;

export function entriesByDay(entries: TrackedEntry[]) {
  const days = new Map<DateKey, TrackedEntry[]>();
  for (const entry of entries) {
    const day = dateKeyOf(entry.startedAt);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }
  return [...days];
}
