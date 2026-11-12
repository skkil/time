import type { SavedView } from '@/backend';
import type { ProjectTab, ProjectViewMemory } from '@/lib/preferences';

export type { ProjectTab };

export type TabOption = { id: ProjectTab; label: string };

export const PROJECT_TABS: TabOption[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
  { id: 'focus', label: 'Focus' },
  { id: 'settings', label: 'Settings' },
];

export const INBOX_KEY = 'inbox';

export type ViewOption =
  | { id: 'list' | 'board' | 'timeline' | 'graph'; label: string }
  | { id: string; label: string; saved: SavedView };

export const isSaved = (
  option: ViewOption,
): option is ViewOption & { saved: SavedView } => 'saved' in option;

export function viewOptions({
  inProject,
  linked,
  saved,
}: {
  inProject: boolean;
  linked: boolean;
  saved: SavedView[];
}): ViewOption[] {
  return [
    { id: 'list', label: 'List' },
    { id: 'board', label: 'Board' },
    ...(inProject ? [{ id: 'timeline' as const, label: 'Timeline' }] : []),
    ...(linked ? [{ id: 'graph' as const, label: 'Graph' }] : []),
    ...(inProject
      ? saved.map((view) => ({
          id: String(view.id),
          label: view.name,
          saved: view,
        }))
      : []),
  ];
}

export const NEXT_VIEW_KEYS = 'V';
export const PREVIOUS_VIEW_KEYS = 'Shift+V';

export function stepView(
  options: ViewOption[],
  currentId: string,
  step: 1 | -1,
): ViewOption {
  const at = options.findIndex((option) => option.id === currentId);
  return options[(at + step + options.length) % options.length];
}

export function chooseView(
  options: ViewOption[],
  remembered: string | undefined,
  fallback: string | undefined,
): ViewOption {
  return (
    options.find((option) => option.id === remembered) ??
    options.find((option) => option.id === fallback) ??
    options[0]
  );
}

export function fallbackView(
  legacyView: string | undefined,
  saved: SavedView[],
): string {
  if (legacyView === 'board') return 'board';
  return saved[0] ? String(saved[0].id) : 'list';
}

export function chooseTab({
  inProject,
  requested,
  memory,
}: {
  inProject: boolean;
  requested: ProjectTab | undefined;
  memory: ProjectViewMemory;
}): ProjectTab {
  if (!inProject) return 'tasks';
  return requested ?? memory.tab ?? 'tasks';
}

export const remembersTab = (tab: ProjectTab) => tab !== 'settings';
