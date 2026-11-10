import type {
  Glance,
  GlanceItem,
  RunningTimer,
} from '@skkil-time/client/types';
import {
  INK,
  SECONDARY_INK,
  SHADE,
  readabilityShade,
} from '@skkil-time/design/contrast';
import { type Rgb, skyAt } from '@skkil-time/design/sky';
import {
  HOUR,
  formatClockTime,
  formatDuration,
  fromSeconds,
  toSeconds,
} from '@skkil-time/rules/time';
import { addDays, startOfDay, startOfHour } from 'date-fns';

export const SNAPSHOT_VERSION = 1;
export const MUSTS_LABEL = 'Musts today';
export const TITLE_LIMIT = 60;
const GLOW_ALPHA = 0.85;
const FAINT_INK = 0.4;
const GLASS = 0.06;
const HAIRLINE = 0.12;

export type Argb = string;

export type WidgetLine = {
  label: string;
  title: string;
  detail: string | null;
  countingFrom: number | null;
};

export type WidgetSky = { top: Argb; bottom: Argb; glow: Argb };

export type WidgetEntry = {
  at: number;
  sky: WidgetSky;
  now: WidgetLine;
  next: WidgetLine | null;
  musts: string[];
  earlier: string | null;
};

export type WidgetInk = {
  primary: Argb;
  secondary: Argb;
  faint: Argb;
  glass: Argb;
  hairline: Argb;
};

export type WidgetSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  writtenAt: number;
  ink: WidgetInk;
  mustsLabel: string;
  entries: WidgetEntry[];
};

const hex2 = (value: number) =>
  Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');

export const argb = ([r, g, b]: Rgb, alpha = 1): Argb =>
  `#${hex2(alpha * 255)}${hex2(r)}${hex2(g)}${hex2(b)}`;

const blend = (a: Rgb, b: Rgb, t: number): Rgb =>
  a.map((value, i) => value + (b[i] - value) * t) as Rgb;

export const INK_COLORS: WidgetInk = {
  primary: argb(INK),
  secondary: argb(INK, SECONDARY_INK),
  faint: argb(INK, FAINT_INK),
  glass: argb([255, 255, 255], GLASS),
  hairline: argb([255, 255, 255], HAIRLINE),
};

export function widgetSky(at: number): WidgetSky {
  const date = fromSeconds(at);
  const sky = skyAt(date.getHours() + date.getMinutes() / 60);
  const shade = readabilityShade(sky);
  const shaded = (color: Rgb) => blend(color, SHADE, shade);
  return {
    top: argb(shaded(sky.top)),
    bottom: argb(shaded(sky.bottom)),
    glow: argb(shaded(sky.glows[0]), GLOW_ALPHA),
  };
}

export function shorten(text: string, limit = TITLE_LIMIT): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(clean);
  if (chars.length <= limit) return clean;
  return `${chars
    .slice(0, limit - 1)
    .join('')
    .trimEnd()}…`;
}

const NOTHING_NOW: WidgetLine = {
  label: 'Now',
  title: 'Nothing planned now',
  detail: null,
  countingFrom: null,
};

const span = (item: GlanceItem) =>
  item.kind === 'task' || item.endsAt === null
    ? formatClockTime(item.startsAt)
    : `${formatClockTime(item.startsAt)}–${formatClockTime(item.endsAt)}`;

const itemLine = (label: string, item: GlanceItem): WidgetLine => ({
  label,
  title: shorten(item.title),
  detail: span(item),
  countingFrom: null,
});

export function timerLine(timer: RunningTimer): WidgetLine {
  const title = shorten(timer.description.trim() || 'Focus');
  if (timer.pausedAt !== null)
    return {
      label: 'Now',
      title,
      detail: `On a break · ${formatDuration(timer.bankedSeconds)}`,
      countingFrom: null,
    };
  return {
    label: 'Now',
    title,
    detail: null,
    countingFrom: timer.startedAt - timer.bankedSeconds,
  };
}

const running = (item: GlanceItem | null, at: number): item is GlanceItem =>
  item !== null &&
  item.endsAt !== null &&
  item.startsAt <= at &&
  item.endsAt > at;

export function earlierLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? '1 task from earlier days'
    : `${count} tasks from earlier days`;
}

function changesBetween(glance: Glance, from: number, until: number) {
  const moments = [
    glance.now?.endsAt,
    glance.next?.startsAt,
    glance.next?.endsAt,
  ];
  for (
    let hour = toSeconds(startOfHour(fromSeconds(from))) + HOUR;
    hour < until;
    hour += HOUR
  )
    moments.push(hour);
  return [
    from,
    ...new Set(
      moments.filter(
        (moment): moment is number =>
          moment !== null &&
          moment !== undefined &&
          moment > from &&
          moment < until,
      ),
    ),
  ].sort((a, b) => a - b);
}

const endOfDay = (at: number) =>
  toSeconds(addDays(startOfDay(fromSeconds(at)), 1));

const DAY_OVER: Omit<WidgetEntry, 'at' | 'sky'> = {
  now: {
    label: 'Today',
    title: 'Open skkil time to see today',
    detail: null,
    countingFrom: null,
  },
  next: null,
  musts: [],
  earlier: null,
};

export function widgetSnapshot(glance: Glance, now: number): WidgetSnapshot {
  const until = endOfDay(now);
  const musts = glance.musts.map((must) => shorten(must.title));
  const earlier = earlierLabel(glance.earlierCount);
  const entries = changesBetween(glance, now, until).map((at): WidgetEntry => {
    const happening = [glance.now, glance.next].find((item) =>
      running(item, at),
    );
    return {
      at,
      sky: widgetSky(at),
      now: glance.timer
        ? timerLine(glance.timer)
        : happening
          ? itemLine('Now', happening)
          : NOTHING_NOW,
      next:
        glance.next && glance.next.startsAt > at
          ? itemLine('Next', glance.next)
          : null,
      musts,
      earlier,
    };
  });
  entries.push({ at: until, sky: widgetSky(until), ...DAY_OVER });
  return {
    version: SNAPSHOT_VERSION,
    writtenAt: now,
    ink: INK_COLORS,
    mustsLabel: MUSTS_LABEL,
    entries,
  };
}

export function signedOutSnapshot(now: number): WidgetSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    writtenAt: now,
    ink: INK_COLORS,
    mustsLabel: MUSTS_LABEL,
    entries: [
      {
        at: now,
        sky: widgetSky(now),
        now: {
          label: 'skkil time',
          title: 'Sign in to see today',
          detail: null,
          countingFrom: null,
        },
        next: null,
        musts: [],
        earlier: null,
      },
    ],
  };
}

export function nextRefresh(glance: Glance, now: number): number {
  const moments = [glance.now?.endsAt, glance.next?.startsAt].filter(
    (moment): moment is number =>
      moment !== null && moment !== undefined && moment > now,
  );
  return Math.min(endOfDay(now), ...moments);
}
