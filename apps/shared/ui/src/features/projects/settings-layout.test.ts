import { describe, expect, it } from 'vitest';

import { SETTINGS_SECTIONS, type SettingId } from './settings-layout';

const FORMER_SETTINGS: Record<string, SettingId> = {
  name: 'name',
  colour: 'color',
  parent: 'parent',
  group: 'group',
  status: 'status',
  'target date': 'targetDate',
  'hours a week': 'weeklyHours',
  review: 'review',
  'stop if': 'stopIf',
  'in order': 'inOrder',
  types: 'types',
  statuses: 'statuses',
  milestones: 'milestones',
  'milestone label': 'milestoneLabel',
  views: 'views',
  preset: 'template',
  archive: 'archive',
  delete: 'delete',
};

const placed = SETTINGS_SECTIONS.flatMap((section) => section.settings);

describe('project settings', () => {
  it.each(Object.entries(FORMER_SETTINGS))(
    'keeps “%s” reachable',
    (_name, id) => {
      expect(placed).toContain(id);
    },
  );

  it('places every setting once', () => {
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(
      [...new Set(Object.values(FORMER_SETTINGS))].sort(),
    );
  });

  it('orders the sections as planned, with Structure collapsed', () => {
    expect(SETTINGS_SECTIONS.map((section) => section.title)).toEqual([
      'General',
      'Planning',
      'Structure',
      'Views',
      'Archive or delete',
    ]);
    expect(
      SETTINGS_SECTIONS.filter((section) => section.collapsible).map(
        (section) => section.id,
      ),
    ).toEqual(['structure']);
  });
});
