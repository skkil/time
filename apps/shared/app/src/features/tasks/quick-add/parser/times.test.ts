import { describe, expect, it } from 'vitest';

import { laterToday, parseTimePhrase } from './times';

describe('parseTimePhrase', () => {
  it.each([
    ['7pm', 19 * 60],
    ['at 7pm', 19 * 60],
    ['9:30am', 9 * 60 + 30],
    ['12am', 0],
    ['12pm', 12 * 60],
    ['16:00', 16 * 60],
    ['at 19:00', 19 * 60],
    ['at 1900', 19 * 60],
    ['at 10', 10 * 60],
    ['at noon', 12 * 60],
    ['in the morning', 9 * 60],
    ['in the afternoon', 12 * 60],
    ['in the evening', 19 * 60],
  ])('reads %s', (phrase, expected) => {
    expect(parseTimePhrase(phrase)).toBe(expected);
  });

  it('refuses times that do not exist', () => {
    expect(parseTimePhrase('13pm')).toBeUndefined();
    expect(parseTimePhrase('at 24')).toBeUndefined();
  });
});

describe('laterToday', () => {
  it('rolls past midnight into following days', () => {
    expect(laterToday(600, 120)).toEqual({ days: 0, minutes: 720 });
    expect(laterToday(1380, 120)).toEqual({ days: 1, minutes: 60 });
  });
});
