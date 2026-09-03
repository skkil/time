import { describe, expect, it } from 'vitest';

import { type ParseContext, parseQuickAdd } from './parse';

const context: ParseContext = {
  today: '2026-11-04',
  projects: [
    { id: 1, name: 'Career' },
    { id: 2, name: 'STiTy (SKKAI)' },
    { id: 3, name: 'STiTy' },
  ],
  sections: [
    { id: 10, name: 'Job Applications', projectId: 1 },
    { id: 11, name: 'Backlog', projectId: null },
  ],
  projectId: null,
};

const parse = (text: string) => parseQuickAdd(text, context);

describe('parseQuickAdd', () => {
  it('reads dates, times and priority', () => {
    const result = parse('Call Arm recruiter tomorrow at 3pm p1');
    expect(result.title).toBe('Call Arm recruiter');
    expect(result.dueDate).toBe('2026-11-05');
    expect(result.dueTime).toBe(15 * 60);
    expect(result.priority).toBe(1);
  });

  it('reads weekdays, month days and relative dates', () => {
    expect(parse('Standup fri').dueDate).toBe('2026-11-06');
    expect(parse('Standup next mon').dueDate).toBe('2026-11-09');
    expect(parse('Submit Nov 20').dueDate).toBe('2026-11-20');
    expect(parse('Submit 3 Jan').dueDate).toBe('2027-01-03');
    expect(parse('Renew in 2 weeks').dueDate).toBe('2026-11-18');
    expect(parse('Deploy 2026-12-01').dueDate).toBe('2026-12-01');
  });

  it('reads repeats with a first occurrence', () => {
    const result = parse('Attend lecture every tue at 16:30 for 1h15m');
    expect(result.title).toBe('Attend lecture');
    expect(result.recurrence).toBe('every tue');
    expect(result.dueDate).toBe('2026-11-10');
    expect(result.dueTime).toBe(16 * 60 + 30);
    expect(result.estimate).toBe(75);
    expect(parse('Run daily').dueDate).toBe('2026-11-04');
  });

  it('picks the longest matching project and its sections', () => {
    const result = parse('Write tests #STiTy (SKKAI) @short @deep-work');
    expect(result.projectId).toBe(2);
    expect(result.labels).toEqual(['short', 'deep-work']);
    expect(result.title).toBe('Write tests');

    const sectioned = parse(
      'Apply to Ericsson #Career /Job Applications {nov 8}',
    );
    expect(sectioned.projectId).toBe(1);
    expect(sectioned.sectionId).toBe(10);
    expect(sectioned.deadline).toBe('2026-11-08');
    expect(sectioned.title).toBe('Apply to Ericsson');
  });

  it('leaves ordinary words alone', () => {
    const result = parse('Decide 5 things to monitor on query planning');
    expect(result.title).toBe('Decide 5 things to monitor on query planning');
    expect(result.tokens).toEqual([]);
    expect(parse('email a@b.com').labels).toEqual([]);
    expect(parse('#Unknown project').projectId).toBeUndefined();
  });

  it('uses the inbox sections when no project is set', () => {
    expect(parse('Idea /Backlog').sectionId).toBe(11);
  });
});
