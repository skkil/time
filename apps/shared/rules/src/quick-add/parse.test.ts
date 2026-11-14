import { describe, expect, it } from 'vitest';

import { type ParseContext, parseQuickAdd } from './parse';

const context: ParseContext = {
  today: '2026-11-04',
  nowMinutes: 10 * 60,
  projects: [
    { id: '1', name: 'Career' },
    { id: '2', name: 'STiTy (SKKAI)' },
    { id: '3', name: 'STiTy' },
  ],
  sections: [
    { id: '10', name: 'Job Applications', projectId: '1' },
    { id: '11', name: 'Backlog', projectId: null },
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

  it('reads yesterday and common misspellings', () => {
    expect(parse('Send invoice yesterday')).toMatchObject({
      title: 'Send invoice',
      dueDate: '2026-11-03',
    });
    expect(parse('Pay rent next fryday').dueDate).toBe('2026-11-13');
    expect(parse('Pay rent wensday').dueDate).toBe('2026-11-11');
    expect(parse('Pay rent tommorow').dueDate).toBe('2026-11-05');
  });

  it('consumes only the matched token and keeps the rest as typed', () => {
    expect(parse('p1 p2 tomorrow every')).toMatchObject({
      title: 'p2 every',
      priority: 1,
      dueDate: '2026-11-05',
    });
    expect(parse('tomorrow today sync')).toMatchObject({
      title: 'today sync',
      dueDate: '2026-11-05',
    });
  });

  it('names a project it could not find', () => {
    expect(parse('Pay #Bills tomorrow')).toMatchObject({
      title: 'Pay #Bills',
      unknownProject: 'Bills',
    });
    expect(parse('Pay #Career').unknownProject).toBeUndefined();
    expect(parse('Pay rent').unknownProject).toBeUndefined();
  });

  it('reads repeats with a first occurrence', () => {
    const result = parse('Attend lecture every tue at 16:30 for 1h15m');
    expect(result.title).toBe('Attend lecture');
    expect(result.recurrence).toBe('every tue');
    expect(result.dueDate).toBeUndefined();
    expect(result.dueTime).toBe(16 * 60 + 30);
    expect(result.estimate).toBe(75);
  });

  it('reads a repeat with a start and end anywhere in the text', () => {
    const result = parse('Water plants every 14 days 7am starting 1 Dec');
    expect(result.title).toBe('Water plants');
    expect(result.recurrence).toBe('every 14 days');
    expect(result.dueDate).toBe('2026-12-01');
    expect(result.dueTime).toBe(7 * 60);

    expect(parse('Stretch everyday until nov 20').recurrence).toBe(
      'everyday ending 2026-11-20',
    );
    expect(parse('Stretch everyday from 10 Nov until 20 Nov')).toMatchObject({
      dueDate: '2026-11-10',
      recurrence: 'everyday ending 2026-11-20',
    });
    expect(parse('Stretch everyday for 3 weeks').recurrence).toBe(
      'everyday ending 2026-11-25',
    );
    expect(parse('Run for 3 weeks').estimate).toBeUndefined();
  });

  it('keeps a deadline apart from a repeat', () => {
    expect(parse('Review every 2 days at 12:00 {Feb 28}')).toMatchObject({
      title: 'Review',
      recurrence: 'every 2 days',
      dueTime: 12 * 60,
      deadline: '2027-02-28',
    });
    expect(parse('Ship {next friday}').deadline).toBe('2026-11-13');
  });

  it('reads a time with no date as the next time it happens', () => {
    expect(parse('Call 6pm').dueDate).toBe('2026-11-04');
    expect(parse('Call 9am').dueDate).toBe('2026-11-05');
    expect(parse('Call in 2 hours')).toMatchObject({
      dueDate: '2026-11-04',
      dueTime: 12 * 60,
    });
    expect(parse('Call in 15 hours')).toMatchObject({
      dueDate: '2026-11-05',
      dueTime: 60,
    });
  });

  it('reads a part of the day after a date', () => {
    expect(parse('Gym tom morning')).toMatchObject({
      title: 'Gym',
      dueDate: '2026-11-05',
      dueTime: 9 * 60,
    });
    expect(parse('Gym tomnight').dueTime).toBe(22 * 60);
    expect(parse('Gym fri evening')).toMatchObject({
      dueDate: '2026-11-06',
      dueTime: 19 * 60,
    });
    expect(parse('Gym in the afternoon').dueTime).toBe(12 * 60);
    expect(parse('Morning pages').tokens).toEqual([]);
  });

  it('reads a person called Tom as a name', () => {
    expect(parse('Call Tom').title).toBe('Call Tom');
    expect(parse('Call Tom').dueDate).toBeUndefined();
    expect(parse('Call Tom tom').dueDate).toBe('2026-11-05');
  });

  it('leaves dismissed phrases as plain text', () => {
    const result = parseQuickAdd('Create monthly report', {
      ...context,
      ignored: new Set(['monthly']),
    });
    expect(result.title).toBe('Create monthly report');
    expect(result.recurrence).toBeUndefined();
    expect(result.tokens).toEqual([]);
  });

  it('picks the longest matching project and its sections', () => {
    const result = parse('Write tests #STiTy (SKKAI)');
    expect(result.projectId).toBe('2');
    expect(result.title).toBe('Write tests');

    const sectioned = parse(
      'Apply to Ericsson #Career /Job Applications {nov 8}',
    );
    expect(sectioned.projectId).toBe('1');
    expect(sectioned.sectionId).toBe('10');
    expect(sectioned.deadline).toBe('2026-11-08');
    expect(sectioned.title).toBe('Apply to Ericsson');
  });

  it('leaves ordinary words alone', () => {
    const result = parse('Decide 5 things to monitor on query planning');
    expect(result.title).toBe('Decide 5 things to monitor on query planning');
    expect(result.tokens).toEqual([]);
    expect(parse('email a@b.com').title).toBe('email a@b.com');
    expect(parse('#Unknown project').projectId).toBeUndefined();
  });

  it('uses the inbox sections when no project is set', () => {
    expect(parse('Idea /Backlog').sectionId).toBe('11');
  });

  it('reads an item type from the target project', () => {
    const parsed = parseQuickAdd('Fix login +Bug #App', {
      today: '2026-11-02',
      nowMinutes: 0,
      projects: [{ id: '7', name: 'App' }],
      sections: [],
      types: [
        { id: '3', name: 'Bug', projectId: '7' },
        { id: '4', name: 'Bug', projectId: '8' },
      ],
      projectId: null,
    });
    expect(parsed.typeId).toBe('3');
    expect(parsed.title).toBe('Fix login');
  });

  it('reads a saved place by name, ignoring case', () => {
    const withPlaces = (text: string) =>
      parseQuickAdd(text, {
        ...context,
        places: [
          { id: '20', name: 'Home' },
          { id: '21', name: 'City library' },
        ],
      });
    expect(withPlaces('Return books @city LIBRARY tomorrow')).toMatchObject({
      title: 'Return books',
      placeId: '21',
      dueDate: '2026-11-05',
    });
    expect(withPlaces('Water plants @home').placeId).toBe('20');
    const unknown = withPlaces('Meet @Office');
    expect(unknown.title).toBe('Meet @Office');
    expect(unknown.placeId).toBeUndefined();
    expect(withPlaces('email a@home.com').placeId).toBeUndefined();
    expect(withPlaces('Home stuff').placeId).toBeUndefined();
  });
});
