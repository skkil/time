import { describe, expect, it } from 'vitest';

import { isDueInAnotherWeek } from './period';

const WEEK = '2026-11-02';
const TODAY = '2026-11-06';

describe('tasks due outside the viewed week', () => {
  it('keeps tasks due within the week, end to end', () => {
    expect(isDueInAnotherWeek('2026-11-06', WEEK, TODAY)).toBe(false);
    expect(isDueInAnotherWeek('2026-11-08', WEEK, TODAY)).toBe(false);
  });

  it('leaves out tasks due in a later week', () => {
    expect(isDueInAnotherWeek('2026-11-09', WEEK, TODAY)).toBe(true);
  });

  it('keeps overdue tasks whichever week is viewed', () => {
    expect(isDueInAnotherWeek('2026-10-20', WEEK, TODAY)).toBe(false);
    expect(isDueInAnotherWeek('2026-10-20', '2026-11-09', TODAY)).toBe(false);
  });

  it('leaves out tasks still to come when viewing a later week', () => {
    expect(isDueInAnotherWeek('2026-11-07', '2026-11-09', TODAY)).toBe(true);
  });
});
