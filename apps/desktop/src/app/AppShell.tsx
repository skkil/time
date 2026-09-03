import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import {
  CalendarDaysIcon,
  ChartColumnIcon,
  InboxIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SunsetIcon,
} from 'lucide-react';
import { type MouseEvent, useMemo, useState } from 'react';

import { Kbd } from '@/components/ui/kbd';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProjectNav } from '@/features/projects/ProjectNav';
import { RitualProvider } from '@/features/rituals/RitualProvider';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { TaskDialogProvider } from '@/features/tasks/TaskDialog';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { TimerPill } from '@/features/time/TimerPill';
import { formatShortcut, useShortcuts } from '@/lib/shortcuts';
import { mondayOf, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';
import { zoomShortcuts } from '@/lib/zoom';

import { SearchDialog } from './SearchDialog';

export function AppShell() {
  return (
    <TaskDialogProvider>
      <RitualProvider>
        <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
          <TopBar />
          <main className="min-h-0 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </RitualProvider>
    </TaskDialogProvider>
  );
}

const chromeButton =
  'flex h-8 items-center gap-2 rounded-md px-2.5 text-sm text-chrome-muted outline-none hover:bg-chrome-accent hover:text-chrome-foreground focus-visible:ring-2 focus-visible:ring-chrome-muted';

function TopBar() {
  const { newTask } = useTaskDialog();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useRouterState({ select: (state) => state.location });
  const thisWeek = mondayOf(todayKey());
  const onMain = location.pathname === '/';
  const search = location.search as { view?: string; week?: string };
  const view = onMain && search.view === 'week' ? 'week' : 'day';
  const onReports = location.pathname.startsWith('/reports');

  const show = (next: 'day' | 'week') =>
    navigate({
      to: '/',
      search: { view: next, week: (onMain && search.week) || thisWeek },
    });

  useShortcuts([
    { keys: 'Mod+K', run: () => setSearching(true) },
    { keys: 'Q', run: newTask, idle: true },
    { keys: 'Mod+N', run: newTask },
    { keys: 'Mod+,', run: () => setSettingsOpen(true) },
    { keys: 'Mod+B', run: () => setDrawerOpen((open) => !open) },
    { keys: 'Mod+1', run: () => show('day') },
    { keys: 'Mod+2', run: () => show('week') },
    { keys: 'Mod+3', run: () => navigate({ to: '/reports/reviews' }) },
    ...zoomShortcuts,
  ]);

  return (
    <header className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-4 bg-chrome px-3 text-chrome-foreground">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={chromeButton}
              onClick={() => setDrawerOpen(true)}
            >
              <PanelLeftIcon className="size-4" strokeWidth={1.5} />
              Tasks
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Inbox, upcoming and projects <Kbd>{formatShortcut('Mod+B')}</Kbd>
          </TooltipContent>
        </Tooltip>
        <span className="ml-2 flex items-center gap-2 font-heading text-[15px] text-chrome-foreground select-none">
          <img src="/favicon.svg" alt="" className="size-5" />
          <span>
            <span className="font-bold">skkil</span> time
          </span>
        </span>
      </div>

      <div
        role="tablist"
        aria-label="View"
        className="flex rounded-lg bg-chrome-accent p-0.5"
      >
        {(['day', 'week'] as const).map((option) => {
          const active = onMain && view === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              title={formatShortcut(option === 'day' ? 'Mod+1' : 'Mod+2')}
              onClick={() => show(option)}
              className={cn(
                'h-7 w-20 rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-chrome-muted',
                active
                  ? 'bg-chrome-foreground text-chrome'
                  : 'text-chrome-muted hover:text-chrome-foreground',
              )}
            >
              {option === 'day' ? 'Day' : 'Week'}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-1">
        <TimerPill />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Search"
              className={chromeButton}
              onClick={() => setSearching(true)}
            >
              <SearchIcon className="size-4" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Search <Kbd>{formatShortcut('Mod+K')}</Kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => newTask()}
              className="flex h-8 items-center gap-1.5 rounded-md bg-chrome-foreground px-3 text-sm font-medium text-chrome outline-none hover:bg-chrome-muted focus-visible:ring-2 focus-visible:ring-chrome-muted focus-visible:ring-offset-2 focus-visible:ring-offset-chrome"
            >
              <PlusIcon className="size-4" strokeWidth={2} />
              Add
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Add a task <Kbd>{formatShortcut('Q')}</Kbd>
          </TooltipContent>
        </Tooltip>
        <Link
          to="/reports/reviews"
          className={cn(
            chromeButton,
            onReports && 'bg-chrome-accent text-chrome-foreground',
          )}
          title={formatShortcut('Mod+3')}
        >
          <ChartColumnIcon className="size-4" strokeWidth={1.5} />
          Reports
        </Link>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Settings"
              className={chromeButton}
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon className="size-4" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Settings <Kbd>{formatShortcut('Mod+,')}</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <TasksDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}

const drawerLink =
  'flex h-8 items-center gap-2.5 rounded-md px-2 text-foreground/85 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:bg-now-tint data-[status=active]:font-semibold data-[status=active]:text-now';

function TasksDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: tasks } = useTasks();
  const today = todayKey();

  const counts = useMemo(() => {
    const pending = (tasks ?? []).filter((task) => task.completedAt === null);
    return {
      inbox: pending.filter((task) => task.projectId === null && !task.someday)
        .length,
      someday: pending.filter((task) => task.someday).length,
    };
  }, [tasks]);

  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a')) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] gap-3">
        <SheetHeader>
          <SheetTitle>Tasks</SheetTitle>
          <SheetDescription className="sr-only">
            Inbox, upcoming, someday and your projects
          </SheetDescription>
        </SheetHeader>
        <div
          className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-3 pb-4"
          onClick={closeOnLink}
        >
          <nav aria-label="Lists">
            <ul className="grid gap-0.5">
              <li>
                <Link to="/inbox" className={drawerLink}>
                  <InboxIcon
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  Inbox
                  {counts.inbox > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {counts.inbox}
                    </span>
                  )}
                </Link>
              </li>
              <li>
                <Link
                  to="/upcoming"
                  search={{ from: today }}
                  className={drawerLink}
                  activeOptions={{ includeSearch: false }}
                >
                  <CalendarDaysIcon
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  Upcoming
                </Link>
              </li>
              <li>
                <Link to="/someday" className={drawerLink}>
                  <SunsetIcon
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                  Someday
                  {counts.someday > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {counts.someday}
                    </span>
                  )}
                </Link>
              </li>
            </ul>
          </nav>
          <ProjectNav />
        </div>
      </SheetContent>
    </Sheet>
  );
}
