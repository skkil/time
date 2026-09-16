import { describe, expect, it } from 'vitest';

import { parseQuickAdd } from './parse';
import REPEAT_PHRASES from './repeat-phrases.json';

const repeat = (text: string) =>
  parseQuickAdd(`Task ${text}`, {
    today: '2026-11-04',
    nowMinutes: 600,
    projects: [],
    sections: [],
    projectId: null,
  });

describe('repeat phrases', () => {
  it.each(REPEAT_PHRASES)('claims "%s" whole', (phrase) => {
    const result = repeat(phrase);
    expect(result.recurrence).toBe(phrase.toLowerCase());
    expect(result.title).toBe('Task');
  });

  it('keeps the time apart from the rule', () => {
    expect(repeat('every mon, fri at 20:00')).toMatchObject({
      recurrence: 'every mon, fri',
      dueTime: 20 * 60,
    });
    expect(repeat('every fri at noon').dueTime).toBe(12 * 60);
    expect(repeat('every 3rd friday 8pm').dueTime).toBe(20 * 60);
  });

  it('leaves repeats it cannot store in the title', () => {
    expect(repeat('every 3 hours').title).toBe('Task every 3 hours');
    expect(repeat('every 2 people').recurrence).toBeUndefined();
  });
});
