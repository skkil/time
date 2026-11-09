import {
  AppWindowIcon,
  ClockIcon,
  GlobeIcon,
  type LucideIcon,
  MoonIcon,
  SunIcon,
  SunriseIcon,
  TimerIcon,
} from 'lucide-react';

import type { DayStatus, Habit, ManualStatus } from '@/backend';
import { type DateKey, dayStart } from '@/lib/time';

export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const ALL_DAYS = 0b111_1111;

export const TIMES_OF_DAY: {
  value: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: 'morning', label: 'Morning', icon: SunriseIcon },
  { value: 'afternoon', label: 'Afternoon', icon: SunIcon },
  { value: 'evening', label: 'Evening', icon: MoonIcon },
  { value: 'anytime', label: 'Anytime', icon: ClockIcon },
];

export const SOURCES: {
  value: string;
  label: string;
  icon: LucideIcon;
  activity?: boolean;
}[] = [
  {
    value: 'website',
    label: 'Websites visited',
    icon: GlobeIcon,
    activity: true,
  },
  { value: 'app', label: 'Apps used', icon: AppWindowIcon, activity: true },
  { value: 'project', label: 'Time tracked on a project', icon: TimerIcon },
];

const number = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

export const unitLabel = (unit: string, value = 2) =>
  unit === 'minutes' ? 'min' : value === 1 ? 'time' : 'times';

export function progressLabel(habit: Habit, value: number): string {
  if (habit.kind === 'quit')
    return value > 0
      ? `${number(value)} ${unitLabel(habit.unit, value)} today`
      : 'Clean today';
  return `${number(value)} / ${number(habit.goal ?? 0)} ${unitLabel(habit.unit, habit.goal ?? 0)}`;
}

export function formatSince(since: DateKey, nowSeconds: number): string {
  const seconds = Math.max(0, nowSeconds - dayStart(since));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h ${minutes}m`;
}

export const NEXT_STATUS: Record<string, ManualStatus | null> = {
  none: 'done',
  done: 'failed',
  failed: 'skipped',
  skipped: null,
};

export const statusLabel: Record<DayStatus, string> = {
  done: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
  pending: 'In progress',
  missed: 'Missed',
  off: 'Not scheduled',
};

export const isScheduled = (status: DayStatus | undefined) =>
  status !== undefined && status !== 'off';
