import { describe, expect, it } from 'vitest';

import { stepBefore } from './reorder';

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
