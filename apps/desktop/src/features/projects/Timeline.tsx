import { differenceInCalendarDays, format } from 'date-fns';
import { FlagIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';

import {
  type DateKey,
  fromDateKey,
  mondayOf,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { projectColorVar } from './tree';

export type MarkKind = 'due' | 'deadline' | 'milestone' | 'target';

export type TimelineMark = {
  date: DateKey;
  kind: MarkKind;
  label: string;
  late?: boolean;
};

export type TimelineRow = {
  id: string;
  label: string;
  color: string;
  depth?: number;
  marks: TimelineMark[];
  span?: { from: DateKey; to: DateKey };
  onOpen?: () => void;
};

export type TimelineLine = { date: DateKey; label: string };

const DAY = 26;
const LABEL = 260;
const ROW = 36;

const KIND_LABEL: Record<MarkKind, string> = {
  due: 'Due',
  deadline: 'Deadline',
  milestone: 'Milestone',
  target: 'Target',
};

function rangeOf(rows: TimelineRow[], lines: TimelineLine[], today: DateKey) {
  const dates = [
    ...rows.flatMap((row) => [
      ...row.marks.map((mark) => mark.date),
      ...(row.span ? [row.span.from, row.span.to] : []),
    ]),
    ...lines.map((line) => line.date),
  ].sort();
  const earliest = dates[0] && dates[0] < today ? dates[0] : today;
  const latest = dates.at(-1) ?? today;
  const start = mondayOf(
    earliest < shiftKey(today, -28) ? shiftKey(today, -28) : earliest,
  );
  const minEnd = shiftKey(today, 56);
  const end = shiftKey(mondayOf(latest > minEnd ? latest : minEnd), 13);
  return {
    start,
    days: differenceInCalendarDays(fromDateKey(end), fromDateKey(start)) + 1,
  };
}

export function Timeline({
  rows,
  lines = [],
  heading,
}: {
  rows: TimelineRow[];
  lines?: TimelineLine[];
  heading: string;
}) {
  const today = todayKey();
  const { start, days } = rangeOf(rows, lines, today);
  const x = (date: DateKey) =>
    differenceInCalendarDays(fromDateKey(date), fromDateKey(start)) * DAY;
  const keys = Array.from({ length: days }, (_, i) => shiftKey(start, i));
  const mondays = keys.filter((_, i) => i % 7 === 0);
  const months = keys.filter((key, i) => i === 0 || key.endsWith('-01'));
  const scroller = useRef<HTMLDivElement>(null);

  const initialScroll = x(today) - 7 * DAY;

  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = initialScroll;
  }, [initialScroll]);

  return (
    <div
      ref={scroller}
      className="relative overflow-x-auto rounded-xl ring-1 ring-white/10"
    >
      <div className="relative" style={{ width: LABEL + days * DAY }}>
        <div
          className={cn(
            'relative z-20 flex border-b border-white/10',
            lines.length > 0 ? 'h-20' : 'h-14',
          )}
        >
          <div
            className="sticky left-0 z-30 flex shrink-0 items-end border-r border-white/10 bg-[rgb(14,22,38)] px-4 pb-2 text-xs font-medium text-foreground/55"
            style={{ width: LABEL }}
          >
            {heading}
          </div>
          <div className="relative flex-1 text-xs text-foreground/55">
            {months.map((key) => (
              <span
                key={key}
                className="absolute top-2 font-medium whitespace-nowrap text-foreground/75"
                style={{ left: x(key) + 6 }}
              >
                {format(fromDateKey(key), 'MMMM yyyy')}
              </span>
            ))}
            {mondays.map((key) => (
              <span
                key={key}
                className="absolute top-7 border-l border-white/15 pl-1.5 tabular-nums"
                style={{ left: x(key) }}
              >
                {format(fromDateKey(key), 'd MMM')}
              </span>
            ))}
            {lines.map((line) => (
              <span
                key={`${line.date}-${line.label}`}
                title={`${line.label} · ${format(fromDateKey(line.date), 'd MMM yyyy')}`}
                className="absolute bottom-2 max-w-40 -translate-x-1/2 truncate rounded-full bg-white/10 px-1.5 text-[11px] text-foreground/80"
                style={{ left: x(line.date) + DAY / 2 }}
              >
                {line.label}
              </span>
            ))}
          </div>
        </div>

        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-0 z-0',
            lines.length > 0 ? 'top-20' : 'top-14',
          )}
          style={{ left: LABEL, right: 0 }}
        >
          {keys.map(
            (key, i) =>
              fromDateKey(key).getDay() % 6 === 0 && (
                <div
                  key={key}
                  className="absolute inset-y-0 bg-white/[.025]"
                  style={{ left: i * DAY, width: DAY }}
                />
              ),
          )}
          {mondays.map((key) => (
            <div
              key={key}
              className="absolute inset-y-0 border-l border-white/[.06]"
              style={{ left: x(key) }}
            />
          ))}
          {lines.map((line) => (
            <div
              key={`${line.date}-${line.label}`}
              className="absolute inset-y-0 border-l border-dashed border-white/30"
              style={{ left: x(line.date) + DAY / 2 }}
            />
          ))}
          <div
            className="absolute inset-y-0 w-0.5 bg-today"
            style={{ left: x(today) + DAY / 2 - 1 }}
          />
        </div>

        <ul className="relative z-10">
          {rows.map((row) => (
            <TimelineRowView key={row.id} row={row} x={x} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function TimelineRowView({
  row,
  x,
}: {
  row: TimelineRow;
  x: (date: DateKey) => number;
}) {
  const groups = new Map<string, TimelineMark[]>();
  for (const mark of row.marks) {
    const key = `${mark.date}|${mark.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), mark]);
  }

  return (
    <li
      className="group/row flex border-b border-white/[.06] last:border-b-0 hover:bg-white/[.03]"
      style={{ height: ROW }}
    >
      <button
        type="button"
        onClick={row.onOpen}
        disabled={!row.onOpen}
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-white/10 bg-[rgb(14,22,38)] pr-3 text-left text-sm outline-none focus-visible:underline enabled:hover:text-foreground"
        style={{ width: LABEL, paddingLeft: 16 + (row.depth ?? 0) * 16 }}
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: projectColorVar(row.color) }}
        />
        <span className="truncate">{row.label}</span>
      </button>
      <div className="relative flex-1">
        {row.span && (
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-40"
            style={{
              left: x(row.span.from) + DAY / 2,
              width: Math.max(x(row.span.to) - x(row.span.from), 0),
              background: projectColorVar(row.color),
            }}
          />
        )}
        {[...groups.values()].map((marks) => (
          <Mark
            key={`${marks[0].date}-${marks[0].kind}`}
            marks={marks}
            color={row.color}
            left={x(marks[0].date) + DAY / 2}
          />
        ))}
      </div>
    </li>
  );
}

function Mark({
  marks,
  color,
  left,
}: {
  marks: TimelineMark[];
  color: string;
  left: number;
}) {
  const { kind, date } = marks[0];
  const late = marks.some((mark) => mark.late);
  const title = [
    `${KIND_LABEL[kind]} ${format(fromDateKey(date), 'EEE d MMM yyyy')}`,
    ...marks.map((mark) => `• ${mark.label}`),
  ].join('\n');

  return (
    <span
      title={title}
      className="absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
      style={{ left }}
    >
      {kind === 'due' && (
        <span
          className={cn(
            'size-2.5 rounded-full ring-2 ring-[rgb(14,22,38)]',
            late && 'outline-2 outline-attention',
          )}
          style={{ background: projectColorVar(color) }}
        />
      )}
      {kind === 'deadline' && (
        <span
          className={cn(
            'size-2.5 rotate-45 rounded-[2px] bg-destructive',
            late && 'outline-2 outline-offset-1 outline-attention',
          )}
        />
      )}
      {kind === 'milestone' && (
        <span className="size-2.5 rotate-45 rounded-[2px] border-2 border-foreground/80 bg-[rgb(14,22,38)]" />
      )}
      {kind === 'target' && (
        <FlagIcon className="size-3.5 text-foreground" strokeWidth={2} />
      )}
      {marks.length > 1 && (
        <span className="absolute -top-2.5 left-2 text-[10px] text-foreground/70 tabular-nums">
          {marks.length}
        </span>
      )}
    </span>
  );
}

export function TimelineLegend() {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/55">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-foreground/70" />
        Due
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rotate-45 rounded-[2px] bg-destructive" />
        Deadline
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rotate-45 rounded-[2px] border-2 border-foreground/80" />
        Milestone
      </span>
      <span className="flex items-center gap-1.5">
        <FlagIcon className="size-3" />
        Target date
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-today" />
        Today
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full outline-2 outline-attention" />
        Overdue
      </span>
    </p>
  );
}
