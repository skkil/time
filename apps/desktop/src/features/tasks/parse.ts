import { addMonths, getDay, isValid, parse, startOfMonth } from 'date-fns';

import type { Id } from '@/bindings';
import {
  type DateKey,
  fromDateKey,
  mondayOf,
  parseDurationInput,
  shiftKey,
  toDateKey,
} from '@/lib/time';

export type TokenKind =
  | 'date'
  | 'time'
  | 'repeat'
  | 'deadline'
  | 'duration'
  | 'priority'
  | 'project'
  | 'section'
  | 'label';

export type Token = { kind: TokenKind; start: number; end: number };

export type ParseContext = {
  today: DateKey;
  projects: { id: Id; name: string }[];
  sections: { id: Id; name: string; projectId: Id | null }[];
  projectId: Id | null;
};

export type Parsed = {
  title: string;
  tokens: Token[];
  dueDate?: DateKey;
  dueTime?: number;
  recurrence?: string;
  deadline?: DateKey;
  estimate?: number;
  priority?: number;
  projectId?: Id | null;
  sectionId?: Id;
  labels: string[];
};

const DAY = String.raw`(?:monday|mon|tuesday|tue|wednesday|wed|thursday|thu|friday|fri|saturday|sat|sunday|sun)`;
const MONTH = String.raw`(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\.?`;
const END = String.raw`(?![\p{L}\p{N}])`;
const START = String.raw`(?<![\p{L}\p{N}])`;

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const weekdayIndex = (word: string) => WEEKDAY_INDEX[word.slice(0, 3)];

function nextWeekday(today: DateKey, day: number, includeToday: boolean) {
  const current = getDay(fromDateKey(today));
  let offset = (day - current + 7) % 7;
  if (offset === 0 && !includeToday) offset = 7;
  return shiftKey(today, offset);
}

function monthDay(
  today: DateKey,
  month: string,
  day: string,
  year?: string,
): DateKey | undefined {
  const at = (yearText: string) => {
    const date = parse(
      `${yearText} ${month.slice(0, 3)} ${day}`,
      'yyyy MMM d',
      fromDateKey(today),
    );
    return isValid(date) ? toDateKey(date) : undefined;
  };
  if (year) return at(year);
  const thisYear = Number(today.slice(0, 4));
  const key = at(String(thisYear));
  return key && key < today ? at(String(thisYear + 1)) : key;
}

export function parseDatePhrase(
  phrase: string,
  today: DateKey,
): DateKey | undefined {
  const text = phrase.trim().toLowerCase();
  if (/^(today|tod)$/.test(text)) return today;
  if (/^(tomorrow|tmr|tmrw|tom)$/.test(text)) return shiftKey(today, 1);
  if (text === 'next week') return shiftKey(mondayOf(today), 7);
  if (text === 'next month')
    return toDateKey(startOfMonth(addMonths(fromDateKey(today), 1)));
  if (/^(this )?weekend$/.test(text)) return nextWeekday(today, 6, true);

  let match = new RegExp(`^(next |on )?(${DAY})$`).exec(text);
  if (match) {
    const day = weekdayIndex(match[2]);
    if (match[1] === 'next ') {
      const offset = (day + 6) % 7;
      return shiftKey(shiftKey(mondayOf(today), 7), offset);
    }
    return nextWeekday(today, day, false);
  }

  match = /^in (\d+) (day|week|month)s?$/.exec(text);
  if (match) {
    const count = Number(match[1]);
    if (match[2] === 'day') return shiftKey(today, count);
    if (match[2] === 'week') return shiftKey(today, count * 7);
    return toDateKey(addMonths(fromDateKey(today), count));
  }

  match = new RegExp(
    `^(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?$`,
  ).exec(text);
  if (match) return monthDay(today, match[1], match[2], match[3]);

  match = new RegExp(
    `^(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})(?:\\s+(\\d{4}))?$`,
  ).exec(text);
  if (match) return monthDay(today, match[2], match[1], match[3]);

  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    const date = parse(text, 'yyyy-MM-dd', fromDateKey(today));
    return isValid(date) ? toDateKey(date) : undefined;
  }
  return undefined;
}

function firstOccurrence(rule: string, today: DateKey): DateKey {
  const text = rule.toLowerCase();
  if (/weekday|workday/.test(text)) {
    const day = getDay(fromDateKey(today));
    return day === 0 || day === 6 ? nextWeekday(today, 1, false) : today;
  }
  const days = [...text.matchAll(new RegExp(DAY, 'g'))].map((m) =>
    weekdayIndex(m[0]),
  );
  if (days.length === 0) return today;
  return days.map((day) => nextWeekday(today, day, true)).sort()[0];
}

function parseClock(hours: string, minutes?: string, meridiem?: string) {
  let h = Number(hours);
  const m = Number(minutes ?? 0);
  if (meridiem) {
    if (h < 1 || h > 12) return undefined;
    h = (h % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  }
  if (h > 23 || m > 59) return undefined;
  return h * 60 + m;
}

function longestName<T extends { name: string }>(
  candidates: T[],
  text: string,
  from: number,
): T | undefined {
  const rest = text.slice(from).toLowerCase();
  return candidates
    .filter((candidate) => {
      const name = candidate.name.toLowerCase();
      if (!rest.startsWith(name)) return false;
      const next = rest.charAt(name.length);
      return next === '' || /\s/.test(next);
    })
    .sort((a, b) => b.name.length - a.name.length)[0];
}

export function parseQuickAdd(text: string, context: ParseContext): Parsed {
  const tokens: Token[] = [];
  const result: Parsed = { title: text, tokens, labels: [] };
  const free = (start: number, end: number) =>
    tokens.every((token) => end <= token.start || start >= token.end);

  const claim = (
    pattern: string,
    kind: TokenKind,
    handle: (match: RegExpExecArray) => boolean,
  ) => {
    const regex = new RegExp(`${START}(?:${pattern})${END}`, 'giu');
    for (const match of text.matchAll(regex)) {
      const start = match.index;
      const end = start + match[0].length;
      if (!free(start, end)) continue;
      if (handle(match as RegExpExecArray)) {
        tokens.push({ kind, start, end });
        return;
      }
    }
  };

  claim(String.raw`\{([^}]+)\}`, 'deadline', (match) => {
    result.deadline = parseDatePhrase(match[1], context.today);
    return result.deadline !== undefined;
  });

  claim(
    String.raw`every\s+(?:weekday|workday)|every\s+(?:other\s+|\d+\s+)?(?:day|week|month|year)s?|every\s+${DAY}(?:(?:\s*,\s*|\s+and\s+)${DAY})*|daily|weekly|monthly|yearly`,
    'repeat',
    (match) => {
      result.recurrence = match[0].toLowerCase().replace(/\s+/g, ' ');
      return true;
    },
  );

  claim(
    String.raw`for\s+(\d+(?:\.\d+)?\s*h(?:ours?|rs?)?(?:\s*\d+\s*m(?:in(?:utes?)?)?)?|\d+\s*m(?:in(?:utes?)?)?)`,
    'duration',
    (match) => {
      const normalized = match[1]
        .toLowerCase()
        .replace(/hours?|hrs?/, 'h')
        .replace(/min(utes?)?/, 'm');
      const minutes = parseDurationInput(normalized);
      if (minutes === null || minutes > 24 * 60) return false;
      result.estimate = minutes;
      return true;
    },
  );

  claim(
    String.raw`(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)|(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)`,
    'time',
    (match) => {
      const minutes = match[3]
        ? parseClock(match[1], match[2], match[3])
        : parseClock(match[4], match[5]);
      if (minutes === undefined) return false;
      result.dueTime = minutes;
      return true;
    },
  );

  claim(
    [
      'today|tod|tomorrow|tmrw|tmr',
      'next\\s+week|next\\s+month|(?:this\\s+)?weekend',
      `(?:next\\s+|on\\s+)?${DAY}`,
      'in\\s+\\d+\\s+(?:day|week|month)s?',
      `${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?`,
      `\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}(?:\\s+\\d{4})?`,
      '\\d{4}-\\d{2}-\\d{2}',
    ].join('|'),
    'date',
    (match) => {
      result.dueDate = parseDatePhrase(
        match[0].replace(/\s+/g, ' '),
        context.today,
      );
      return result.dueDate !== undefined;
    },
  );

  claim('p([1-4])', 'priority', (match) => {
    result.priority = Number(match[1]);
    return true;
  });

  const projects = [
    { id: null as Id | null, name: 'Inbox' },
    ...context.projects,
  ];
  for (const match of text.matchAll(/(?<=^|\s)#/g)) {
    const project = longestName(projects, text, match.index + 1);
    const end = match.index + 1 + (project?.name.length ?? 0);
    if (project && free(match.index, end)) {
      tokens.push({ kind: 'project', start: match.index, end });
      result.projectId = project.id;
      break;
    }
  }

  const projectId =
    result.projectId !== undefined ? result.projectId : context.projectId;
  const sections = context.sections.filter(
    (section) => section.projectId === projectId,
  );
  for (const match of text.matchAll(/(?<=^|\s)\//g)) {
    const section = longestName(sections, text, match.index + 1);
    const end = match.index + 1 + (section?.name.length ?? 0);
    if (section && free(match.index, end)) {
      tokens.push({ kind: 'section', start: match.index, end });
      result.sectionId = section.id;
      break;
    }
  }

  for (const match of text.matchAll(/(?<=^|\s)@([^\s@#]+)/gu)) {
    const end = match.index + match[0].length;
    if (!free(match.index, end)) continue;
    tokens.push({ kind: 'label', start: match.index, end });
    if (!result.labels.includes(match[1])) result.labels.push(match[1]);
  }

  if (result.recurrence && !result.dueDate)
    result.dueDate = firstOccurrence(result.recurrence, context.today);
  if (result.dueTime !== undefined && !result.dueDate)
    result.dueDate = context.today;

  tokens.sort((a, b) => a.start - b.start);
  let title = '';
  let cursor = 0;
  for (const token of tokens) {
    title += text.slice(cursor, token.start);
    cursor = token.end;
  }
  title += text.slice(cursor);
  result.title = title.replace(/\s+/g, ' ').trim();
  return result;
}
