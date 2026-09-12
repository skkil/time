import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { PlusIcon, SearchIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHabitSync } from '@/features/habits/api';
import { RitualProvider } from '@/features/rituals/RitualProvider';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { TaskDialogProvider } from '@/features/tasks/TaskDialog';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { TimerPill } from '@/features/time/TimerPill';
import { ZenBackdrop } from '@/features/zen/ZenBackdrop';
import { getPreference, usePreference } from '@/lib/preferences';
import { formatShortcut, useShortcuts } from '@/lib/shortcuts';
import { todayKey, weekStartOf } from '@/lib/time';
import { cn } from '@/lib/utils';
import { zoomShortcuts } from '@/lib/zoom';

import { SearchDialog } from './SearchDialog';

export function AppShell() {
  return (
    <TaskDialogProvider>
      <RitualProvider>
        <Canvas />
      </RitualProvider>
    </TaskDialogProvider>
  );
}

type Space = 'day' | 'week' | 'projects';
const SPACES: { id: Space; label: string; keys: string }[] = [
  { id: 'day', label: 'Day', keys: 'Mod+1' },
  { id: 'week', label: 'Week', keys: 'Mod+2' },
  { id: 'projects', label: 'Projects', keys: 'Mod+3' },
];

function Canvas() {
  useHabitSync();
  const { newTask } = useTaskDialog();
  const { active } = useRitualRunner();
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useRouterState({ select: (state) => state.location });
  const search = location.search as { view?: string; week?: string };
  const onMain = location.pathname === '/';
  const space: Space | null = location.pathname.startsWith('/projects')
    ? 'projects'
    : onMain
      ? search.view === 'week'
        ? 'week'
        : 'day'
      : null;

  const go = (next: Space) => {
    if (next === 'projects') {
      const last = getPreference('lastProject');
      if (last === 'someday') return navigate({ to: '/projects/someday' });
      const id = Number(last);
      return Number.isInteger(id) && id > 0
        ? navigate({ to: '/projects/$projectId', params: { projectId: id } })
        : navigate({ to: '/projects' });
    }
    return navigate({
      to: '/',
      search: {
        view: next,
        week: (onMain && search.week) || weekStartOf(todayKey()),
      },
    });
  };

  useShortcuts([
    { keys: 'Mod+K', run: () => setSearching(true) },
    { keys: 'Q', run: newTask, idle: true },
    { keys: 'Mod+N', run: newTask },
    { keys: 'Mod+,', run: () => setSettingsOpen(true) },
    ...SPACES.map((option) => ({
      keys: option.keys,
      run: () => void go(option.id),
    })),
    ...zoomShortcuts,
  ]);

  return (
    <div className="relative h-full overflow-hidden text-foreground">
      <ZenBackdrop deep={active !== null} className="fixed" />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center px-6 pt-5">
        <div className="pointer-events-auto justify-self-start">
          <ProfileMenu
            onSearch={() => setSearching(true)}
            onSettings={() => setSettingsOpen(true)}
            onAdd={() => newTask()}
          />
        </div>
        <SpaceToggle value={space} onChange={go} />
        <div className="pointer-events-auto justify-self-end">
          <TimerPill />
        </div>
      </header>
      <main className="relative z-10 h-full pt-20">
        <Outlet />
      </main>
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function SpaceToggle({
  value,
  onChange,
}: {
  value: Space | null;
  onChange: (space: Space) => void;
}) {
  const index = SPACES.findIndex((option) => option.id === value);
  return (
    <div
      role="tablist"
      aria-label="Space"
      className="pointer-events-auto relative grid grid-cols-3 rounded-full bg-white/[.07] p-1 backdrop-blur-md"
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-white/[.14] transition-[transform,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
          index < 0 && 'opacity-0',
        )}
        style={{ transform: `translateX(${Math.max(index, 0) * 100}%)` }}
      />
      {SPACES.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={option.id === value}
          title={formatShortcut(option.keys)}
          onClick={() => onChange(option.id)}
          className={cn(
            'relative h-7 w-20 rounded-full text-[13px] tracking-wide transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/50',
            option.id === value
              ? 'text-foreground'
              : 'text-foreground/55 hover:text-foreground/85',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProfileMenu({
  onSearch,
  onSettings,
  onAdd,
}: {
  onSearch: () => void;
  onSettings: () => void;
  onAdd: () => void;
}) {
  const name = usePreference('profileName').trim();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu"
          className="grid size-9 place-items-center rounded-full bg-white/10 text-[13px] font-medium text-foreground ring-1 ring-white/20 backdrop-blur-md transition-colors outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {name ? (
            name[0].toUpperCase()
          ) : (
            <UserIcon className="size-4" strokeWidth={1.5} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={10} className="w-56">
        {name && <DropdownMenuLabel>{name}</DropdownMenuLabel>}
        <DropdownMenuItem onSelect={onAdd}>
          <PlusIcon />
          Add a task
          <DropdownMenuShortcut>{formatShortcut('Q')}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSearch}>
          <SearchIcon />
          Search
          <DropdownMenuShortcut>{formatShortcut('Mod+K')}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSettings}>
          <SettingsIcon />
          Settings
          <DropdownMenuShortcut>{formatShortcut('Mod+,')}</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
