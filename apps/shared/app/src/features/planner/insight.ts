import type { OutcomeStatus } from '@/backend';
import { formatDuration } from '@/lib/time';

export type InsightWeek = {
  trackedSeconds: number;
  plannedSeconds: number;
  outcomes: { title: string; status: OutcomeStatus; trackedSeconds: number }[];
  projects: { name: string; seconds: number }[];
  habits: { name: string; kind: string; done: number; due: number }[];
};

export type Insight = {
  text: string;
  action?: { label: string; target: 'next-week' | 'habits' };
};

const HOUR = 3600;

export function pickInsight(week: InsightWeek): Insight | null {
  const top = [...week.projects].sort((a, b) => b.seconds - a.seconds)[0];
  const neglected = week.outcomes.find(
    (outcome) =>
      (outcome.status === 'open' || outcome.status === 'carried') &&
      outcome.trackedSeconds === 0,
  );
  if (
    neglected &&
    top &&
    week.trackedSeconds > 0 &&
    top.seconds >= week.trackedSeconds / 2
  )
    return {
      text: `Most of the week went to ${top.name}; ${neglected.title} got no time.`,
      action: { label: 'Block time for it', target: 'next-week' },
    };

  if (
    week.plannedSeconds >= 5 * HOUR &&
    week.plannedSeconds >= 1.25 * week.trackedSeconds
  )
    return {
      text: `Planned ${formatDuration(week.plannedSeconds)}, focused ${formatDuration(week.trackedSeconds)}.`,
      action: { label: 'Plan fewer blocks', target: 'next-week' },
    };

  const slipping = week.habits.find(
    (habit) =>
      habit.kind === 'build' && habit.due > 0 && habit.done * 2 < habit.due,
  );
  if (slipping)
    return {
      text: `${slipping.name}: done on ${slipping.done} of ${slipping.due} planned days.`,
      action: { label: 'Lower its daily goal', target: 'habits' },
    };

  const counted = week.outcomes.filter(
    (outcome) => outcome.status !== 'dropped',
  );
  if (counted.length > 0 && counted.every((o) => o.status === 'achieved'))
    return {
      text: `All ${counted.length} outcomes done.`,
    };

  return null;
}
