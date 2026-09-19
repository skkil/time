import type { Id } from '@/bindings';
import { shiftKey } from '@/lib/time';

import { DATE_PATTERN, parseDatePhrase } from './dates';
import { DURATION_PATTERN, parseDuration } from './durations';
import { claimEntity, unclaimedName } from './entities';
import {
  REPEAT_END_PATTERN,
  REPEAT_PHRASE_PATTERN,
  REPEAT_START_PATTERN,
  REPEAT_WORD_PATTERN,
  normalizeRepeat,
  repeatEnd,
  withEnd,
} from './repeats';
import { createScanner } from './scanner';
import {
  DAY_PART,
  RELATIVE_TIME_PATTERN,
  TIME_PATTERN,
  dayPartMinutes,
  laterToday,
  parseTimePhrase,
  relativeMinutes,
} from './times';
import type { ParseContext, Parsed } from './types';

export type { ParseContext, Parsed, Token, TokenKind } from './types';

const DATE_WITH_DAY_PART = `(?:${DATE_PATTERN})(?:\\s*(?<dayPart>${DAY_PART}))?`;
const PERSON_NAMED_TOM = /^Tom(?![a-z])/;
const INBOX = { id: null as Id | null, name: 'Inbox' };

export function parseQuickAdd(text: string, context: ParseContext): Parsed {
  const { today, nowMinutes } = context;
  const scanner = createScanner(text, context.ignored);
  const result: Parsed = { title: text, tokens: scanner.tokens };

  scanner.claim(String.raw`\{([^}]+)\}`, 'deadline', (match) => {
    result.deadline = parseDatePhrase(match[1], today);
    return result.deadline !== undefined;
  });

  const claimRepeat = (match: RegExpExecArray) => {
    result.recurrence = normalizeRepeat(match[0]);
    return true;
  };
  scanner.claim(REPEAT_PHRASE_PATTERN, 'repeat', claimRepeat);
  if (!result.recurrence)
    scanner.claim(REPEAT_WORD_PATTERN, 'repeat', claimRepeat);

  if (result.recurrence) {
    const repeat = result.recurrence;
    scanner.claim(REPEAT_START_PATTERN, 'repeat', (match) => {
      result.dueDate = parseDatePhrase(match.groups?.date ?? '', today);
      return result.dueDate !== undefined;
    });
    scanner.claim(REPEAT_END_PATTERN, 'repeat', (match) => {
      const end = repeatEnd(match.groups ?? {}, result.dueDate ?? today, today);
      if (end) result.recurrence = withEnd(repeat, end);
      return end !== undefined;
    });
  }

  scanner.claim(DURATION_PATTERN, 'duration', (match) => {
    result.estimate = parseDuration(match[1]);
    return result.estimate !== undefined;
  });

  scanner.claim(TIME_PATTERN, 'time', (match) => {
    result.dueTime = parseTimePhrase(match[0]);
    return result.dueTime !== undefined;
  });

  scanner.claim(RELATIVE_TIME_PATTERN, 'time', (match) => {
    const { count, unit, koCount, koUnit } = match.groups ?? {};
    const offset = relativeMinutes(count ?? koCount, unit ?? koUnit);
    const later = laterToday(nowMinutes, offset);
    result.dueDate = shiftKey(today, later.days);
    result.dueTime = later.minutes;
    return true;
  });

  const claimDate = (match: RegExpExecArray) => {
    if (PERSON_NAMED_TOM.test(match[0])) return false;
    const dayPart = match.groups?.dayPart;
    const phrase = dayPart ? match[0].slice(0, -dayPart.length) : match[0];
    const date = parseDatePhrase(phrase, today);
    if (!date) return false;
    result.dueDate ??= date;
    if (dayPart) result.dueTime ??= dayPartMinutes(dayPart);
    return true;
  };
  scanner.claim(DATE_WITH_DAY_PART, 'date', claimDate);
  if (!result.tokens.some((token) => token.kind === 'date'))
    scanner.claim(DATE_PATTERN, 'date', claimDate);

  scanner.claim('p([1-4])', 'priority', (match) => {
    result.priority = Number(match[1]);
    return true;
  });

  const project = claimEntity(scanner, '#', 'project', [
    INBOX,
    ...context.projects,
  ]);
  if (project) result.projectId = project.id;
  else result.unknownProject = unclaimedName(scanner, '#');

  const projectId = project ? project.id : context.projectId;
  const section = claimEntity(
    scanner,
    '/',
    'section',
    context.sections.filter((item) => item.projectId === projectId),
  );
  if (section) result.sectionId = section.id;

  const type = claimEntity(
    scanner,
    '+',
    'type',
    (context.types ?? []).filter((item) => item.projectId === projectId),
  );
  if (type) result.typeId = type.id;

  if (result.dueTime !== undefined && !result.dueDate && !result.recurrence)
    result.dueDate = result.dueTime > nowMinutes ? today : shiftKey(today, 1);

  result.title = scanner.remainder();
  return result;
}
