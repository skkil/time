import { describe, expect, it } from 'vitest';

import { searchScore } from './search';

describe('searchScore', () => {
  it('ranks exact, then prefix, then word starts, then inside a word', () => {
    const exact = searchScore('Draft', '', 'draft');
    const prefix = searchScore('Draft chapter 2', '', 'draft');
    const word = searchScore('Second draft', '', 'draft');
    const inside = searchScore('Redrafting notes', '', 'draft');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(inside);
  });

  it('drops loose letter matches', () => {
    expect(searchScore('Submit insurance claim for kitchen', '', 'sink')).toBe(
      0,
    );
    expect(searchScore('Fix the sink', '', 'sink')).toBeGreaterThan(0);
  });

  it('needs every word, and notes count for less than the title', () => {
    expect(searchScore('Call dentist', '', 'call mom')).toBe(0);
    expect(searchScore('Call mom', '', 'call mom')).toBe(1);
    const inNotes = searchScore('Errands', 'pick up sink parts', 'sink');
    expect(inNotes).toBeGreaterThan(0);
    expect(inNotes).toBeLessThan(searchScore('Fix the sink', '', 'sink'));
  });

  it('matches Korean titles', () => {
    expect(searchScore('치과 예약', '', '치과')).toBeGreaterThan(0.8);
  });
});
