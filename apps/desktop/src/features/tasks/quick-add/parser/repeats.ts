import { addMonths } from 'date-fns';

import { type DateKey, fromDateKey, shiftKey, toDateKey } from '@/lib/time';

import { DATE_PATTERN, parseDatePhrase } from './dates';
import { DAY, MONTH, NTH, ORDINAL } from './vocabulary';

const UNIT = '(?:day|week|month|quarter|year)s?';
const LIST_JOIN = String.raw`(?:\s*,\s*(?:and\s+)?|\s+and\s+)`;

const DAY_TERM = [
  String.raw`last\s+day`,
  String.raw`(?:${ORDINAL}|${NTH})\s+workday`,
  String.raw`${NTH}\s+${DAY}(?:\s+(?:of\s+)?${MONTH})?`,
  String.raw`${MONTH}\s+\d{1,2}(?:st|nd|rd|th)?`,
  String.raw`\d{1,2}(?:st|nd|rd|th)?\s+${MONTH}`,
  DAY,
  ORDINAL,
].join('|');

const EVERY_BODY = [
  String.raw`other\s+(?:day|week|month|year|${DAY})`,
  String.raw`\d+\s+(?:${UNIT}|workdays?)`,
  String.raw`\d{1,2}(?:\s*,\s*\d{1,2})+`,
  'weekday|workday|weekend',
  UNIT,
  String.raw`(?:${DAY_TERM})(?:${LIST_JOIN}(?:${DAY_TERM}))*`,
].join('|');

export const REPEAT_PATTERN = [
  String.raw`(?:every|ev)!?\s+(?:${EVERY_BODY})`,
  String.raw`after\s+\d+\s+(?:day|week|month|year)s?`,
  'everyday|daily|weekly|monthly|quarterly|yearly|annually',
].join('|');

export const REPEAT_START_PATTERN = String.raw`(?:starting(?:\s+on)?|from)\s+(?<date>${DATE_PATTERN})`;

export const REPEAT_END_PATTERN = [
  String.raw`(?:ending|until)\s+(?<date>${DATE_PATTERN})`,
  String.raw`for\s+(?<count>\d+)\s+(?<unit>day|week|month)s?`,
].join('|');

export const normalizeRepeat = (text: string) =>
  text.toLowerCase().replace(/\s+/g, ' ');

export const withEnd = (recurrence: string, end: DateKey) =>
  `${recurrence} ending ${end}`;

export function repeatEnd(
  groups: Record<string, string | undefined>,
  from: DateKey,
  today: DateKey,
): DateKey | undefined {
  if (groups.date) return parseDatePhrase(groups.date, today);
  const count = Number(groups.count);
  const unit = groups.unit?.toLowerCase();
  if (unit === 'month') return toDateKey(addMonths(fromDateKey(from), count));
  return shiftKey(from, unit === 'week' ? count * 7 : count);
}
