export type SettingId =
  | 'name'
  | 'color'
  | 'parent'
  | 'group'
  | 'status'
  | 'targetDate'
  | 'weeklyHours'
  | 'review'
  | 'stopIf'
  | 'inOrder'
  | 'types'
  | 'statuses'
  | 'milestones'
  | 'milestoneLabel'
  | 'template'
  | 'views'
  | 'archive'
  | 'delete';

export type SettingsSection = {
  id: string;
  title: string;
  hint?: string;
  collapsible?: boolean;
  settings: SettingId[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'general',
    title: 'General',
    settings: ['name', 'color', 'parent', 'group', 'status'],
  },
  {
    id: 'planning',
    title: 'Planning',
    settings: ['targetDate', 'weeklyHours', 'review', 'stopIf', 'inOrder'],
  },
  {
    id: 'structure',
    title: 'Structure',
    hint: 'Item types, statuses and milestones, for work that needs more than a list.',
    collapsible: true,
    settings: ['types', 'statuses', 'milestones', 'milestoneLabel', 'template'],
  },
  {
    id: 'views',
    title: 'Views',
    settings: ['views'],
  },
  {
    id: 'danger',
    title: 'Archive or delete',
    settings: ['archive', 'delete'],
  },
];
