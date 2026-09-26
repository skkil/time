import { describe, expect, it } from 'vitest';

import { formatDuration } from './time';

describe('formatDuration', () => {
  it('counts whole minutes, so a short session never adds one', () => {
    expect(formatDuration(59)).toBe('0m');
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(115 * 60 + 29)).toBe('1h 55m');
    expect(formatDuration(115 * 60 + 31)).toBe('1h 55m');
    expect(formatDuration(2 * 3600)).toBe('2h');
  });
});
