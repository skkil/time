import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parse,
  startOfDay,
  startOfWeek,
} from 'date-fns';

export type DateKey = string;

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const MINUTE = 60;
export const HOUR = 60 * MINUTE;

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const toDateKey = (date: Date): DateKey => format(date, 'yyyy-MM-dd');

export function fromDateKey(key: DateKey): Date {
  const date = parse(key, 'yyyy-MM-dd', new Date());
  return isValid(date) ? date : startOfDay(new Date());
}

export const todayKey = () => toDateKey(new Date());

export const shiftKey = (key: DateKey, days: number) =>
  toDateKey(addDays(fromDateKey(key), days));

export const mondayOf = (key: DateKey): DateKey =>
  toDateKey(startOfWeek(fromDateKey(key), { weekStartsOn: 1 }));

export const weekStartOf = (key: DateKey, startsOn: WeekStart): DateKey =>
  toDateKey(startOfWeek(fromDateKey(key), { weekStartsOn: startsOn }));

export const reviewWeekOf = (start: DateKey): DateKey =>
  mondayOf(shiftKey(start, 3));

export const weekOfMonday = (monday: DateKey, startsOn: WeekStart): DateKey =>
  weekStartOf(shiftKey(monday, 3), startsOn);

export const weekKeys = (monday: DateKey): DateKey[] =>
  Array.from({ length: 7 }, (_, i) => shiftKey(monday, i));

export const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

export const fromSeconds = (seconds: number) => new Date(seconds * 1000);

export const dayStart = (key: DateKey) => toSeconds(fromDateKey(key));

export const secondsWithin = (
  entry: { startedAt: number; endedAt: number },
  from: DateKey,
  to: DateKey,
) =>
  Math.max(
    0,
    Math.min(entry.endedAt, dayStart(to)) -
      Math.max(entry.startedAt, dayStart(from)),
  );

export const dateKeyOf = (seconds: number): DateKey =>
  toDateKey(fromSeconds(seconds));

export function minutesIntoDay(seconds: number): number {
  const date = fromSeconds(seconds);
  return date.getHours() * 60 + date.getMinutes();
}

export function atMinutes(key: DateKey, minutes: number): number {
  const date = fromDateKey(key);
  date.setHours(0, minutes, 0, 0);
  return toSeconds(date);
}

export const formatClockTime = (seconds: number) =>
  format(fromSeconds(seconds), 'HH:mm');

export function formatMinutesOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatStopwatch(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / HOUR);
  const m = Math.floor((safe % HOUR) / MINUTE);
  const s = safe % MINUTE;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatEstimate(minutes: number): string {
  return formatDuration(minutes * MINUTE);
}

export function formatDayLabel(key: DateKey, today = todayKey()): string {
  const diff = differenceInCalendarDays(fromDateKey(key), fromDateKey(today));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return format(fromDateKey(key), 'EEE d MMM');
}

export const formatWeekday = (key: DateKey) => format(fromDateKey(key), 'EEE');

export const formatDayOfMonth = (key: DateKey) => format(fromDateKey(key), 'd');

export function formatWeekRange(monday: DateKey): string {
  const start = fromDateKey(monday);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${format(start, 'd')} – ${format(end, 'd MMMM yyyy')}`
    : `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
}

export const isoWeekNumber = (key: DateKey) =>
  Number(format(fromDateKey(key), 'I'));

export function parseClockInput(value: string): number | null {
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2] ?? 0);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function parseDurationInput(value: string): number | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  const clock = /^(\d+):(\d{2})$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const parts = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m?)?$/.exec(text);
  if (!parts || (!parts[1] && !parts[2])) return null;
  const minutes = Math.round(
    Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0),
  );
  return minutes > 0 ? minutes : null;
}
