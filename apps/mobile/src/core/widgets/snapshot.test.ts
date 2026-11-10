import type { Glance, GlanceItem } from '@skkil-time/client/types';
import { toSeconds } from '@skkil-time/rules/time';
import { describe, expect, it } from 'vitest';

import {
  argb,
  earlierLabel,
  nextRefresh,
  shorten,
  signedOutSnapshot,
  timerLine,
  widgetSnapshot,
} from '@/core/widgets/snapshot';

const at = (hours: number, minutes = 0) =>
  toSeconds(new Date(2026, 10, 10, hours, minutes));

const block = (title: string, from: number, to: number): GlanceItem => ({
  kind: 'block',
  title,
  taskId: title,
  startsAt: from,
  endsAt: to,
});

const EMPTY: Glance = {
  timer: null,
  now: null,
  next: null,
  musts: [],
  earlierCount: 0,
};

describe('shorten', () => {
  it('keeps short titles and squeezes whitespace', () => {
    expect(shorten('  Write   the spec ')).toBe('Write the spec');
  });

  it('cuts long titles on a character boundary with an ellipsis', () => {
    expect(shorten('Write the quarterly report', 10)).toBe('Write the…');
    expect(shorten('😀😀😀😀😀', 3)).toBe('😀😀…');
  });
});

describe('argb', () => {
  it('writes alpha first, as Android and the widget read it', () => {
    expect(argb([241, 241, 238])).toBe('#fff1f1ee');
    expect(argb([255, 255, 255], 0.4)).toBe('#66ffffff');
  });
});

describe('earlierLabel', () => {
  it('counts like Day does and hides at zero', () => {
    expect(earlierLabel(0)).toBeNull();
    expect(earlierLabel(1)).toBe('1 task from earlier days');
    expect(earlierLabel(4)).toBe('4 tasks from earlier days');
  });
});

describe('timerLine', () => {
  it('counts a running timer from its banked start', () => {
    const line = timerLine({
      description: 'Deep work',
      projectId: null,
      taskId: null,
      startedAt: at(9),
      pausedAt: null,
      bankedSeconds: 600,
    });
    expect(line).toEqual({
      label: 'Now',
      title: 'Deep work',
      detail: null,
      countingFrom: at(9) - 600,
    });
  });

  it('shows a break with the time so far and a plain title when unnamed', () => {
    const line = timerLine({
      description: ' ',
      projectId: null,
      taskId: null,
      startedAt: at(9),
      pausedAt: at(9, 30),
      bankedSeconds: 1500,
    });
    expect(line).toMatchObject({
      title: 'Focus',
      detail: 'On a break · 25m',
      countingFrom: null,
    });
  });
});

describe('widgetSnapshot', () => {
  it('shows nothing planned, the musts and the earlier count on a quiet day', () => {
    const snapshot = widgetSnapshot(
      {
        ...EMPTY,
        musts: [
          { id: 'a', title: 'Call the bank' },
          { id: 'b', title: 'Send invoice' },
        ],
        earlierCount: 2,
      },
      at(22, 15),
    );
    expect(snapshot.version).toBe(1);
    expect(snapshot.writtenAt).toBe(at(22, 15));
    expect(snapshot.entries.map((entry) => entry.at)).toEqual([
      at(22, 15),
      at(23),
      at(24),
    ]);
    expect(snapshot.entries[0]).toMatchObject({
      now: { label: 'Now', title: 'Nothing planned now' },
      next: null,
      musts: ['Call the bank', 'Send invoice'],
      earlier: '2 tasks from earlier days',
    });
  });

  it('moves on when the current block ends and the next one starts', () => {
    const snapshot = widgetSnapshot(
      {
        ...EMPTY,
        now: block('Write spec', at(22), at(22, 30)),
        next: block('Read', at(22, 45), at(23, 30)),
      },
      at(22, 10),
    );
    const states = snapshot.entries.map((entry) => ({
      at: entry.at,
      now: entry.now.title,
      detail: entry.now.detail,
      next: entry.next?.title ?? null,
    }));
    expect(states).toEqual([
      {
        at: at(22, 10),
        now: 'Write spec',
        detail: '22:00–22:30',
        next: 'Read',
      },
      {
        at: at(22, 30),
        now: 'Nothing planned now',
        detail: null,
        next: 'Read',
      },
      { at: at(22, 45), now: 'Read', detail: '22:45–23:30', next: null },
      { at: at(23), now: 'Read', detail: '22:45–23:30', next: null },
      { at: at(23, 30), now: 'Nothing planned now', detail: null, next: null },
      {
        at: at(24),
        now: 'Open skkil time to see today',
        detail: null,
        next: null,
      },
    ]);
  });

  it('shows a timed task as next with its time only, and drops it once due', () => {
    const snapshot = widgetSnapshot(
      {
        ...EMPTY,
        next: {
          kind: 'task',
          title: 'Pick up parcel',
          taskId: 't',
          startsAt: at(23, 20),
          endsAt: null,
        },
      },
      at(23, 5),
    );
    expect(snapshot.entries[0].next).toEqual({
      label: 'Next',
      title: 'Pick up parcel',
      detail: '23:20',
      countingFrom: null,
    });
    expect(snapshot.entries[1]).toMatchObject({ at: at(23, 20), next: null });
  });

  it('lets a running timer take the now slot all day', () => {
    const snapshot = widgetSnapshot(
      {
        ...EMPTY,
        timer: {
          description: 'Inbox zero',
          projectId: null,
          taskId: null,
          startedAt: at(23),
          pausedAt: null,
          bankedSeconds: 0,
        },
        now: block('Write spec', at(23), at(23, 30)),
      },
      at(23, 10),
    );
    const days = snapshot.entries.slice(0, -1);
    expect(days.every((entry) => entry.now.title === 'Inbox zero')).toBe(true);
    expect(days[0].now.countingFrom).toBe(at(23));
  });

  it('ends with a day-over entry at midnight and paints the sky per entry', () => {
    const snapshot = widgetSnapshot(EMPTY, at(12));
    expect(snapshot.entries).toHaveLength(13);
    const last = snapshot.entries.at(-1)!;
    expect(last.at).toBe(at(24));
    expect(last.musts).toEqual([]);
    for (const entry of snapshot.entries)
      expect(entry.sky.top).toMatch(/^#ff[0-9a-f]{6}$/);
    expect(snapshot.entries[0].sky).not.toEqual(last.sky);
  });
});

describe('signedOutSnapshot', () => {
  it('asks to sign in', () => {
    const snapshot = signedOutSnapshot(at(9));
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].now.title).toBe('Sign in to see today');
  });
});

describe('nextRefresh', () => {
  it('reads again when the current item ends or the next starts, else at midnight', () => {
    const now = block('Write spec', at(9), at(10));
    const next = block('Read', at(11), at(12));
    expect(nextRefresh({ ...EMPTY, now, next }, at(9, 30))).toBe(at(10));
    expect(nextRefresh({ ...EMPTY, next }, at(10, 30))).toBe(at(11));
    expect(nextRefresh(EMPTY, at(10, 30))).toBe(at(24));
  });
});
