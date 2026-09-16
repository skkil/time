import { describe, expect, it } from 'vitest';

import { parseDatePhrase } from './dates';

const WEDNESDAY = '2026-11-04';
const date = (phrase: string, today = WEDNESDAY) =>
  parseDatePhrase(phrase, today);

describe('parseDatePhrase', () => {
  it.each([
    ['today', '2026-11-04'],
    ['tod', '2026-11-04'],
    ['tomorrow', '2026-11-05'],
    ['tom', '2026-11-05'],
    ['next week', '2026-11-09'],
    ['next month', '2026-12-04'],
    ['next year', '2027-01-01'],
    ['this weekend', '2026-11-07'],
    ['weekend', '2026-11-07'],
    ['next weekend', '2026-11-14'],
    ['end of month', '2026-11-30'],
    ['mid January', '2027-01-15'],
    ['in 5 days', '2026-11-09'],
    ['+5 days', '2026-11-09'],
    ['in 3 weeks', '2026-11-25'],
    ['in 2 months', '2027-01-04'],
  ])('reads %s', (phrase, expected) => {
    expect(date(phrase)).toBe(expected);
  });

  it('reads weekdays the way Todoist does', () => {
    expect(date('Friday')).toBe('2026-11-06');
    expect(date('next Friday')).toBe('2026-11-13');
    expect(date('next Tuesday', '2026-10-19')).toBe('2026-10-27');
    expect(date('next mon', '2026-11-06')).toBe('2026-11-09');
  });

  it.each([
    ['jan 27', '2027-01-27'],
    ['27 jan', '2027-01-27'],
    ['27/1', '2027-01-27'],
    ['01/27/2027', '2027-01-27'],
    ['27/01/2027', '2027-01-27'],
    ['2027/01/27', '2027-01-27'],
    ['2027-01-27', '2027-01-27'],
    ['Nov 5, 2027', '2027-11-05'],
  ])('reads the date format %s', (phrase, expected) => {
    expect(date(phrase)).toBe(expected);
  });

  it('reads an ambiguous short date as day first', () => {
    expect(date('5/12')).toBe('2026-12-05');
  });

  it('rolls past dates forward and refuses impossible ones', () => {
    expect(date('nov 3')).toBe('2027-11-03');
    expect(date('nov 4')).toBe('2026-11-04');
    expect(date('feb 30')).toBeUndefined();
    expect(date('31/2/2027')).toBeUndefined();
  });

  it('reads a day of the month', () => {
    expect(date('27th')).toBe('2026-11-27');
    expect(date('2nd')).toBe('2026-12-02');
    expect(date('on the 27th')).toBe('2026-11-27');
  });

  it('reads the nth weekday of a month', () => {
    expect(date('3rd friday jan')).toBe('2027-01-15');
    expect(date('first monday of december')).toBe('2026-12-07');
    expect(date('last friday of november')).toBe('2026-11-27');
  });

  it('reads holidays', () => {
    expect(date('new year day')).toBe('2027-01-01');
    expect(date("new year's eve")).toBe('2026-12-31');
    expect(date("valentine's day")).toBe('2027-02-14');
    expect(date('halloween')).toBe('2027-10-31');
  });

  it('reads offsets from another date', () => {
    expect(date("50 days before new year's eve")).toBe('2026-11-11');
    expect(date('6 weeks before 21 Jul')).toBe('2027-06-09');
    expect(date('28 days after 21 July')).toBe('2027-08-18');
  });

  it('refuses words it does not know', () => {
    expect(date('soon')).toBeUndefined();
    expect(date('')).toBeUndefined();
  });
});
