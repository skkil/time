import { describe, expect, it } from 'vitest';

import { countTasks, toImport } from './convert';

const TODAY = '2026-11-08';

const todoist = [
  'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG',
  'task,Plan trip,,4,1,Me,,tomorrow,en,,30,minute,,',
  'note,Book early,,,,,,,,,,,,',
  'task,Pack bag,Socks too,1,2,Me,,,en,,,,,',
  ',,,,,,,,,,,,,',
  'section,Errands,,,,,,,,,,,,',
  'task,Water plants,,1,1,Me,,every day,en,,,,,',
  'task,Call the bank,,2,1,Me,,whenever it rains,en,,,,,',
].join('\n');

describe('toImport', () => {
  it('reads a Todoist export: nesting, notes, sections, priority and dates', () => {
    const [project] = toImport(
      [{ name: 'Holiday [2203306141]', text: todoist }],
      TODAY,
    );
    expect(project.name).toBe('Holiday');
    const [trip] = project.tasks;
    expect(trip.task).toMatchObject({
      title: 'Plan trip',
      priority: 1,
      dueDate: '2026-11-09',
      estimateMinutes: 30,
      notes: 'Book early',
    });
    expect(trip.children[0].task).toMatchObject({
      title: 'Pack bag',
      notes: 'Socks too',
      priority: 4,
    });
    const [errands] = project.sections;
    expect(errands.name).toBe('Errands');
    expect(errands.tasks[0].task.recurrence).toBe('every day');
    expect(errands.tasks[1].task).toMatchObject({
      dueDate: null,
      notes: 'Due: whenever it rains',
    });
    expect(countTasks([project])).toBe(4);
  });

  it('reads a plain CSV and groups rows by project', () => {
    const text = [
      'Title,Notes,Due,Priority,Project',
      'Buy milk,,today,p2,Home',
      'Draft intro,,,1,Thesis',
      ',,,,',
    ].join('\n');
    const projects = toImport([{ name: 'export', text }], TODAY);
    expect(projects.map((p) => p.name)).toEqual(['Home', 'Thesis']);
    expect(projects[0].tasks[0].task).toMatchObject({
      title: 'Buy milk',
      dueDate: TODAY,
      priority: 2,
    });
    expect(projects[0].color).not.toBe(projects[1].color);
  });

  it('skips files with no tasks', () => {
    expect(toImport([{ name: 'empty', text: 'Title\n' }], TODAY)).toEqual([]);
  });
});
