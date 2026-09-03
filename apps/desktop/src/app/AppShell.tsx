import {
  Link,
  type LinkProps,
  Outlet,
  useNavigate,
} from '@tanstack/react-router';
import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  ChevronDownIcon,
  InboxIcon,
  type LucideIcon,
  NotebookPenIcon,
  PlusIcon,
  RepeatIcon,
  SearchIcon,
  SettingsIcon,
  TimerIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { ProjectNav } from '@/features/projects/ProjectNav';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { TaskDialogProvider } from '@/features/tasks/TaskDialog';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { SidebarTimer } from '@/features/time/SidebarTimer';
import { formatShortcut, useShortcuts } from '@/lib/shortcuts';
import { mondayOf, todayKey } from '@/lib/time';
import { zoomShortcuts } from '@/lib/zoom';

import { SearchDialog } from './SearchDialog';

type NavItem = {
  label: string;
  icon: LucideIcon;
  link: LinkProps;
  count?: number;
};

const linkClass =
  'flex h-8 items-center gap-2.5 rounded-md px-2 text-sidebar-foreground/85 outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:bg-now-tint data-[status=active]:font-semibold data-[status=active]:text-now';

export function AppShell() {
  return (
    <TaskDialogProvider>
      <div className="grid h-full grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar />
        <main className="min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </TaskDialogProvider>
  );
}

function NavLinks({ items, offset }: { items: NavItem[]; offset: number }) {
  return (
    <ul className="grid gap-0.5">
      {items.map((item, i) => (
        <li key={item.label}>
          <Link
            {...item.link}
            title={`Ctrl+${offset + i + 1}`}
            className={linkClass}
            activeOptions={{ includeSearch: false }}
          >
            <item.icon
              className="size-4 text-muted-foreground"
              strokeWidth={1.5}
            />
            {item.label}
            {item.count ? (
              <span className="ml-auto text-xs text-muted-foreground">
                {item.count}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Sidebar() {
  const { data: tasks } = useTasks();
  const { newTask } = useTaskDialog();
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const today = todayKey();
  const week = mondayOf(today);

  const counts = useMemo(() => {
    const open = (tasks ?? []).filter((task) => task.completedAt === null);
    return {
      inbox: open.filter((task) => task.projectId === null).length,
      today: open.filter(
        (task) => task.dueDate !== null && task.dueDate <= today,
      ).length,
    };
  }, [tasks, today]);

  const taskItems: NavItem[] = [
    {
      label: 'Inbox',
      icon: InboxIcon,
      link: { to: '/inbox' },
      count: counts.inbox,
    },
    {
      label: 'Today',
      icon: CalendarCheckIcon,
      link: { to: '/today' },
      count: counts.today,
    },
    {
      label: 'Upcoming',
      icon: CalendarDaysIcon,
      link: { to: '/upcoming', search: { from: todayKey() } },
    },
  ];
  const planItems: NavItem[] = [
    {
      label: 'Planner',
      icon: CalendarRangeIcon,
      link: { to: '/planner', search: { week } },
    },
    { label: 'Time', icon: TimerIcon, link: { to: '/time', search: { week } } },
    {
      label: 'Habits',
      icon: RepeatIcon,
      link: { to: '/habits', search: { week } },
    },
    {
      label: 'Review',
      icon: NotebookPenIcon,
      link: { to: '/review' },
    },
  ];

  const items = [...taskItems, ...planItems];
  useShortcuts([
    { keys: 'Mod+K', run: () => setSearching(true) },
    { keys: 'Q', run: newTask, idle: true },
    { keys: 'Mod+N', run: newTask },
    { keys: 'Mod+,', run: () => setSettingsOpen(true) },
    ...items.map((item, index) => ({
      keys: `Mod+${index + 1}`,
      run: () => navigate(item.link),
    })),
    ...zoomShortcuts,
  ]);

  return (
    <aside className="flex min-h-0 flex-col gap-3 border-r border-sidebar-border bg-sidebar px-3 py-3 text-sidebar-foreground">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-9 items-center gap-2 self-start rounded-md px-2 outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring">
          <img src="/favicon.svg" alt="" className="size-6" />
          <span className="font-heading text-[15px]">
            <span className="font-bold">skkil</span> time
          </span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <SettingsIcon />
            Settings…
            <DropdownMenuShortcut>
              {formatShortcut('Mod+,')}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <nav aria-label="Main" className="grid gap-0.5">
        <button
          type="button"
          onClick={() => newTask()}
          className="group/add flex h-8 items-center gap-2.5 rounded-md px-2 font-medium text-now outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="grid size-[18px] place-items-center rounded-full bg-now text-background">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
          </span>
          Add task
          <Kbd className="ml-auto">{formatShortcut('Q')}</Kbd>
        </button>
        <button
          type="button"
          onClick={() => setSearching(true)}
          className="flex h-8 items-center gap-2.5 rounded-md px-2 text-sidebar-foreground/85 outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SearchIcon
            className="size-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          Search
          <Kbd className="ml-auto">{formatShortcut('Mod+K')}</Kbd>
        </button>
        <NavLinks items={taskItems} offset={0} />
      </nav>

      <nav aria-label="Plan">
        <NavLinks items={planItems} offset={taskItems.length} />
      </nav>

      <div className="-mx-3 grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-3">
        <ProjectNav />
      </div>

      <SidebarTimer />
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  );
}
