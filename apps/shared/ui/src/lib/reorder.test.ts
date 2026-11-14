import { describe, expect, it } from 'vitest';

import { renumber, stepBefore } from './reorder';

describe('stepBefore', () => {
  const ids = ['a', 'b', 'c'];

  it('moves up before the previous sibling', () => {
    expect(stepBefore(ids, 'c', -1)).toBe('b');
    expect(stepBefore(ids, 'b', -1)).toBe('a');
  });

  it('moves down before the sibling after next, or to the end', () => {
    expect(stepBefore(ids, 'a', 1)).toBe('c');
    expect(stepBefore(ids, 'b', 1)).toBeNull();
  });

  it('refuses to move past either end', () => {
    expect(stepBefore(ids, 'a', -1)).toBeUndefined();
    expect(stepBefore(ids, 'c', 1)).toBeUndefined();
    expect(stepBefore(ids, 'missing', 1)).toBeUndefined();
  });
});

describe('renumber', () => {
  const rows = ['a', 'b', 'c'].map((id, i) => ({ id, position: i + 1 }));
  const order = (moved: typeof rows) =>
    moved.map((row) => `${row.id}${row.position}`).join(' ');

  it('moves a row before another and numbers from one', () => {
    expect(order(renumber(rows, 'c', 'a'))).toBe('c1 a2 b3');
  });

  it('moves a row to the end without a row to go before', () => {
    expect(order(renumber(rows, 'a', null))).toBe('b1 c2 a3');
  });
});
