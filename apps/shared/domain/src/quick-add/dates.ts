import {
  type DateKey,
  fromDateKey,
  mondayOf,
  shiftKey,
  toDateKey,
} from '#time';
import {
  addMonths,
  addYears,
  endOfMonth,
  getDay,
  isValid,
  lastDayOfMonth,
} from 'date-fns';

import { KOREAN_DATE_RULES } from './korean';
import { type PhraseRule, ruleTable } from './rules';
import {
  DAY,
  LOOSE_DAY,
  MONTH,
  NTH,
  monthIndex,
  nthIndex,
  weekdayIndex,
} from './vocabulary';

const SATURDAY = 6;
const MID_MONTH_DAY = 15;
const WEEK = 7;

type DateRule = PhraseRule<DateKey, DateKey>;

function calendarDate(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  const exact =
    isValid(date) && date.getMonth() === month && date.getDate() === day;
  return exact ? toDateKey(date) : undefined;
}

function upcomingDate(today: DateKey, month: number, day: number) {
  const year = fromDateKey(today).getFullYear();
  const key = calendarDate(year, month, day);
  return key && key < today ? calendarDate(year + 1, month, day) : key;
}

function nextWeekday(today: DateKey, day: number, includeToday: boolean) {
  let offset = (day - getDay(fromDateKey(today)) + WEEK) % WEEK;
  if (offset === 0 && !includeToday) offset = WEEK;
  return shiftKey(today, offset);
}

function shiftBy(date: DateKey, count: number, unit: string): DateKey {
  const word = unit.toLowerCase();
  if (word.startsWith('day')) return shiftKey(date, count);
  if (word.startsWith('week')) return shiftKey(date, count * WEEK);
  const months = word.startsWith('month') ? count : count * 12;
  return toDateKey(addMonths(fromDateKey(date), months));
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number | 'last',
) {
  if (nth === 'last') {
    const last = lastDayOfMonth(new Date(year, month, 1));
    const back = (getDay(last) - weekday + WEEK) % WEEK;
    return calendarDate(year, month, last.getDate() - back);
  }
  const first = getDay(new Date(year, month, 1));
  const offset = (weekday - first + WEEK) % WEEK;
  return calendarDate(year, month, 1 + offset + (nth - 1) * WEEK);
}

function upcomingNthWeekday(
  today: DateKey,
  nth: string,
  day: string,
  month: string,
) {
  const year = fromDateKey(today).getFullYear();
  const at = (target: number) =>
    nthWeekdayOfMonth(
      target,
      monthIndex(month),
      weekdayIndex(day),
      nthIndex(nth),
    );
  const key = at(year);
  return key && key >= today ? key : at(year + 1);
}

function slashDate(
  today: DateKey,
  first: number,
  second: number,
  year?: string,
) {
  const dayFirst = second <= 12;
  const [day, month] = dayFirst ? [first, second] : [second, first];
  return year
    ? calendarDate(Number(year), month - 1, day)
    : upcomingDate(today, month - 1, day);
}

function dayOfMonth(today: DateKey, day: number) {
  const date = fromDateKey(today);
  const key = calendarDate(date.getFullYear(), date.getMonth(), day);
  if (key && key >= today) return key;
  const next = addMonths(date, 1);
  return calendarDate(next.getFullYear(), next.getMonth(), day);
}

const holiday =
  (month: number, day: number): DateRule['resolve'] =>
  (_, today) =>
    upcomingDate(today, month, day);

const BASE_RULES: DateRule[] = [
  { pattern: 'today|tod', resolve: (_, today) => today },
  {
    pattern: 'tomorrow|tomorow|tommorow|tommorrow|tmrw|tmr|tom',
    resolve: (_, today) => shiftKey(today, 1),
  },
  {
    pattern: 'yesterday|yesturday|yday',
    resolve: (_, today) => shiftKey(today, -1),
  },
  {
    pattern: String.raw`next\s+week`,
    resolve: (_, today) => shiftKey(mondayOf(today), WEEK),
  },
  {
    pattern: String.raw`next\s+month`,
    resolve: (_, today) => toDateKey(addMonths(fromDateKey(today), 1)),
  },
  {
    pattern: String.raw`next\s+year`,
    resolve: (_, today) =>
      calendarDate(addYears(fromDateKey(today), 1).getFullYear(), 0, 1),
  },
  {
    pattern: String.raw`next\s+weekend`,
    resolve: (_, today) => shiftKey(nextWeekday(today, SATURDAY, true), WEEK),
  },
  {
    pattern: String.raw`(?:this\s+)?weekend`,
    resolve: (_, today) => nextWeekday(today, SATURDAY, true),
  },
  {
    pattern: String.raw`end\s+of\s+(?:the\s+)?month`,
    resolve: (_, today) => toDateKey(endOfMonth(fromDateKey(today))),
  },
  {
    pattern: String.raw`mid\s+(${MONTH})`,
    resolve: ([, month], today) =>
      upcomingDate(today, monthIndex(month), MID_MONTH_DAY),
  },
  { pattern: String.raw`new\s+year(?:'?s)?\s+day`, resolve: holiday(0, 1) },
  { pattern: String.raw`new\s+year(?:'?s)?\s+eve`, resolve: holiday(11, 31) },
  {
    pattern: String.raw`valentine(?:'?s(?:\s+day)?)?`,
    resolve: holiday(1, 14),
  },
  { pattern: 'halloween', resolve: holiday(9, 31) },
  {
    pattern: String.raw`(${NTH})\s+(${DAY})\s+(?:of\s+)?(${MONTH})`,
    resolve: ([, nth, day, month], today) =>
      upcomingNthWeekday(today, nth, day, month),
  },
  {
    pattern: String.raw`(next\s+|on\s+)?(${LOOSE_DAY})`,
    resolve: ([, prefix, day], today) => {
      const index = weekdayIndex(day);
      if (!prefix?.toLowerCase().startsWith('next'))
        return nextWeekday(today, index, false);
      const fromMonday = (index + 6) % WEEK;
      return shiftKey(mondayOf(today), WEEK + fromMonday);
    },
  },
  {
    pattern: String.raw`(?:in\s+|\+)(\d+)\s+(day|week|month|year)s?`,
    resolve: ([, count, unit], today) => shiftBy(today, Number(count), unit),
  },
  {
    pattern: String.raw`(${MONTH})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?`,
    resolve: ([, month, day, year], today) =>
      year
        ? calendarDate(Number(year), monthIndex(month), Number(day))
        : upcomingDate(today, monthIndex(month), Number(day)),
  },
  {
    pattern: String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH})(?:,?\s+(\d{4}))?`,
    resolve: ([, day, month, year], today) =>
      year
        ? calendarDate(Number(year), monthIndex(month), Number(day))
        : upcomingDate(today, monthIndex(month), Number(day)),
  },
  {
    pattern: String.raw`(\d{4})[-/](\d{1,2})[-/](\d{1,2})`,
    resolve: ([, year, month, day]) =>
      calendarDate(Number(year), Number(month) - 1, Number(day)),
  },
  {
    pattern: String.raw`(\d{1,2})/(\d{1,2})(?:/(\d{4}))?`,
    resolve: ([, first, second, year], today) =>
      slashDate(today, Number(first), Number(second), year),
  },
  {
    pattern: String.raw`on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)`,
    resolve: ([, day], today) => dayOfMonth(today, Number(day)),
  },
  {
    pattern: String.raw`(\d{1,2})(?:st|nd|rd|th)`,
    resolve: ([, day], today) => dayOfMonth(today, Number(day)),
    phraseOnly: true,
  },
  ...KOREAN_DATE_RULES,
];

const base = ruleTable(BASE_RULES);

const OFFSET_RULE: DateRule = {
  pattern: String.raw`(\d+)\s+(day|week|month)s?\s+(before|after)\s+(${base.pattern})`,
  resolve: ([, count, unit, direction, anchor], today) => {
    const date = base.parse(anchor, today);
    if (!date) return undefined;
    const signed = direction.toLowerCase() === 'before' ? -count : +count;
    return shiftBy(date, signed, unit);
  },
};

const dates = ruleTable([OFFSET_RULE, ...BASE_RULES]);

export const DATE_PATTERN = dates.pattern;

export const parseDatePhrase = (phrase: string, today: DateKey) =>
  dates.parse(phrase, today);
