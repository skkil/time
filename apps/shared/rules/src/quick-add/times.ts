import {
  KOREAN_DAY_PARTS,
  KOREAN_RELATIVE_TIME_PATTERN,
  KOREAN_TIME_RULES,
} from './korean';
import { type PhraseRule, ruleTable } from './rules';

const NOON = 12 * 60;
const MINUTES_IN_DAY = 24 * 60;

const DAY_PARTS: Record<string, number> = {
  morning: 9 * 60,
  afternoon: NOON,
  evening: 19 * 60,
  night: 22 * 60,
  ...KOREAN_DAY_PARTS,
};

export const DAY_PART = Object.keys(DAY_PARTS).join('|');

export const dayPartMinutes = (part: string) => DAY_PARTS[part.toLowerCase()];

function clock(hours: string, minutes = '0', meridiem?: string) {
  let hour = Number(hours);
  const minute = Number(minutes);
  if (meridiem) {
    if (hour < 1 || hour > 12) return undefined;
    hour = (hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  }
  return hour > 23 || minute > 59 ? undefined : hour * 60 + minute;
}

const RULES: PhraseRule<number, void>[] = [
  {
    pattern: String.raw`(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)`,
    resolve: ([, hours, minutes, meridiem]) => clock(hours, minutes, meridiem),
  },
  {
    pattern: String.raw`(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)`,
    resolve: ([, hours, minutes]) => clock(hours, minutes),
  },
  {
    pattern: String.raw`at\s+([01]\d|2[0-3])([0-5]\d)`,
    resolve: ([, hours, minutes]) => clock(hours, minutes),
  },
  {
    pattern: String.raw`at\s+(\d{1,2})`,
    resolve: ([, hours]) => clock(hours),
  },
  { pattern: String.raw`(?:at\s+)?noon`, resolve: () => NOON },
  {
    pattern: String.raw`in\s+the\s+(${DAY_PART})`,
    resolve: ([, part]) => dayPartMinutes(part),
  },
  ...KOREAN_TIME_RULES,
];

const times = ruleTable(RULES);

export const TIME_PATTERN = times.pattern;

export const parseTimePhrase = (phrase: string) =>
  times.parse(phrase, undefined);

export const RELATIVE_TIME_PATTERN = [
  String.raw`in\s+(?<count>\d+)\s+(?<unit>hour|hr|minute|min)s?`,
  KOREAN_RELATIVE_TIME_PATTERN,
].join('|');

export function relativeMinutes(count: string, unit: string) {
  const perUnit = /^(?:h|시간)/i.test(unit) ? 60 : 1;
  return Number(count) * perUnit;
}

export function laterToday(nowMinutes: number, minutes: number) {
  const total = nowMinutes + minutes;
  return {
    days: Math.floor(total / MINUTES_IN_DAY),
    minutes: total % MINUTES_IN_DAY,
  };
}
