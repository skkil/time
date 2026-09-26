import { describe, expect, it } from 'vitest';

import { type InsightWeek, pickInsight } from './insight';

const HOUR = 3600;

const week = (patch: Partial<InsightWeek>): InsightWeek => ({
  trackedSeconds: 10 * HOUR,
  plannedSeconds: 10 * HOUR,
  outcomes: [],
  projects: [],
  habits: [],
  ...patch,
});

describe('pickInsight', () => {
  it('names an outcome that got no time while one project took most of it', () => {
    const insight = pickInsight(
      week({
        outcomes: [{ title: 'Ship v2', status: 'open', trackedSeconds: 0 }],
        projects: [
          { name: 'CLIP', seconds: 6 * HOUR },
          { name: 'Admin', seconds: 4 * HOUR },
        ],
      }),
    );
    expect(insight?.text).toBe(
      'Most of the week went to CLIP; Ship v2 got no time.',
    );
    expect(insight?.action?.target).toBe('next-week');
  });

  it('compares planned and tracked hours when planning ran ahead', () => {
    const insight = pickInsight(
      week({ plannedSeconds: 22 * HOUR, trackedSeconds: 14 * HOUR }),
    );
    expect(insight?.text).toBe('Planned 22h, focused 14h.');
  });

  it('ignores small plans', () => {
    expect(
      pickInsight(week({ plannedSeconds: 4 * HOUR, trackedSeconds: 1 * HOUR })),
    ).toBeNull();
  });

  it('points at a build habit done on fewer than half its days', () => {
    const insight = pickInsight(
      week({
        habits: [
          { name: 'Run', kind: 'build', done: 2, due: 5 },
          { name: 'No phone', kind: 'quit', done: 0, due: 7 },
        ],
      }),
    );
    expect(insight?.text).toBe('Run: done on 2 of 5 planned days.');
    expect(insight?.action?.target).toBe('habits');
  });

  it('notes when every outcome was achieved', () => {
    const insight = pickInsight(
      week({
        outcomes: [
          { title: 'A', status: 'achieved', trackedSeconds: HOUR },
          { title: 'B', status: 'achieved', trackedSeconds: HOUR },
          { title: 'C', status: 'dropped', trackedSeconds: 0 },
        ],
      }),
    );
    expect(insight).toEqual({ text: 'All 2 outcomes done.' });
  });

  it('returns nothing for an ordinary week', () => {
    expect(pickInsight(week({}))).toBeNull();
  });
});
