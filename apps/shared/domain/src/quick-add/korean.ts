import {
  type DateKey,
  fromDateKey,
  mondayOf,
  shiftKey,
  toDateKey,
} from '#time';
import { addMonths } from 'date-fns';

import type { PhraseRule } from './rules';

const PARTICLE = '(?:에는|에|까지|부터)?';
const WEEK = 7;
const SATURDAY_FROM_MONDAY = 5;
const WEEKDAYS = '월화수목금토일';
const NOON = 12 * 60;

const WEEK_OFFSETS: Record<string, number> = {
  이번: 0,
  다음: 1,
  담: 1,
  다다음: 2,
};

const dayShift =
  (days: number): PhraseRule<DateKey, DateKey>['resolve'] =>
  (_, today) =>
    shiftKey(today, days);

const inWeek = (today: DateKey, word: string, fromMonday: number) =>
  shiftKey(mondayOf(today), WEEK_OFFSETS[word] * WEEK + fromMonday);

function upcomingWeekday(today: DateKey, fromMonday: number) {
  const todayFromMonday = (fromDateKey(today).getDay() + WEEK - 1) % WEEK;
  const ahead = (fromMonday - todayFromMonday + WEEK) % WEEK || WEEK;
  return shiftKey(today, ahead);
}

function upcomingMonthDay(today: DateKey, month: number, day: number) {
  const year = fromDateKey(today).getFullYear();
  const at = (target: number) => {
    const date = new Date(target, month - 1, day);
    return date.getMonth() === month - 1 ? toDateKey(date) : undefined;
  };
  const key = at(year);
  return key && key < today ? at(year + 1) : key;
}

export const KOREAN_DATE_RULES: PhraseRule<DateKey, DateKey>[] = [
  { pattern: `오늘${PARTICLE}`, resolve: dayShift(0) },
  { pattern: `(?:내일\\s*모레|모레)${PARTICLE}`, resolve: dayShift(2) },
  { pattern: `내일${PARTICLE}`, resolve: dayShift(1) },
  { pattern: `글피${PARTICLE}`, resolve: dayShift(3) },
  { pattern: `어제${PARTICLE}`, resolve: dayShift(-1) },
  { pattern: `(?:그저께|그제)${PARTICLE}`, resolve: dayShift(-2) },
  {
    pattern: `(이번|다다음|다음|담)\\s*주\\s*([${WEEKDAYS}])요일${PARTICLE}`,
    resolve: ([, week, day], today) =>
      inWeek(today, week, WEEKDAYS.indexOf(day)),
  },
  {
    pattern: `([${WEEKDAYS}])요일${PARTICLE}`,
    resolve: ([, day], today) => upcomingWeekday(today, WEEKDAYS.indexOf(day)),
  },
  {
    pattern: `(이번|다음|담)?\\s*주말${PARTICLE}`,
    resolve: ([, week], today) =>
      inWeek(today, week ?? '이번', SATURDAY_FROM_MONDAY),
  },
  {
    pattern: `(다다음|다음|담)\\s*주${PARTICLE}`,
    resolve: ([, week], today) => inWeek(today, week, 0),
  },
  {
    pattern: `다음\\s*달${PARTICLE}`,
    resolve: (_, today) => toDateKey(addMonths(fromDateKey(today), 1)),
  },
  {
    pattern: `(\\d{1,2})월\\s*(\\d{1,2})일${PARTICLE}`,
    resolve: ([, month, day], today) =>
      upcomingMonthDay(today, Number(month), Number(day)),
  },
  {
    pattern: `(\\d+)\\s*(일|주|개월|달)\\s*(?:후|뒤)${PARTICLE}`,
    resolve: ([, count, unit], today) => {
      const amount = Number(count);
      if (unit === '일') return shiftKey(today, amount);
      if (unit === '주') return shiftKey(today, amount * WEEK);
      return toDateKey(addMonths(fromDateKey(today), amount));
    },
  },
];

export const KOREAN_DAY_PARTS: Record<string, number> = {
  새벽: 6 * 60,
  아침: 9 * 60,
  오전: 9 * 60,
  점심: NOON,
  오후: NOON,
  저녁: 19 * 60,
  밤: 22 * 60,
};

const MORNING_WORDS = new Set(['새벽', '아침', '오전']);

function koreanClock(part: string | undefined, hours: string, minutes = '0') {
  const hour = Number(hours);
  const minute = Number(minutes);
  if (minute > 59) return undefined;
  if (part === undefined) return hour > 23 ? undefined : hour * 60 + minute;
  if (hour < 1 || hour > 12) return undefined;
  const afterNoon = !MORNING_WORDS.has(part);
  return ((hour % 12) + (afterNoon ? 12 : 0)) * 60 + minute;
}

export const KOREAN_TIME_RULES: PhraseRule<number, void>[] = [
  {
    pattern: `(?:(${Object.keys(KOREAN_DAY_PARTS).join('|')}|낮)\\s*)?(\\d{1,2})시(?:\\s*(?:(\\d{1,2})분|(반)))?${PARTICLE}`,
    resolve: ([, part, hours, minutes, half]) =>
      koreanClock(part, hours, half ? '30' : minutes),
  },
  { pattern: `정오${PARTICLE}`, resolve: () => NOON },
  { pattern: `자정${PARTICLE}`, resolve: () => 0 },
];

export const KOREAN_RELATIVE_TIME_PATTERN = `(?<koCount>\\d+)\\s*(?<koUnit>시간|분)\\s*(?:후|뒤)${PARTICLE}`;
