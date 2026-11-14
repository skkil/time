import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { InboxIcon } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { useTasks } from '@/features/tasks/api';
import { NARROW, useMediaQuery } from '@/hooks/use-media-query';
import { setPreference, usePreference } from '@/lib/preferences';
import { useShortcuts } from '@/lib/shortcuts';
import { cn } from '@/lib/utils';

import { ProjectNav } from './ProjectNav';
import { PROJECTS_NAV_KEYS } from './ProjectsNavToggle';

const listLink =
  'flex h-8 items-center gap-2.5 rounded-md px-2 text-foreground/80 outline-none transition-colors hover:bg-white/[.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/40 data-[status=active]:bg-white/[.1] data-[status=active]:text-foreground';

export function ProjectsSpace() {
  const { data: tasks } = useTasks();
  const open = usePreference('projectsSidebarOpen');
  useShortcuts([
    {
      keys: PROJECTS_NAV_KEYS,
      run: () => setPreference('projectsSidebarOpen', !open),
    },
  ]);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const narrow = useMediaQuery(NARROW);
  const shown = useRef(pathname);

  useEffect(() => {
    const rest = pathname.replace(/^\/projects\/?/, '');
    setPreference('lastProject', rest === '' ? 'inbox' : rest);
    if (shown.current !== pathname && matchMedia(NARROW).matches)
      setPreference('projectsSidebarOpen', false);
    shown.current = pathname;
  }, [pathname]);

  const inboxCount = useMemo(
    () =>
      (tasks ?? []).filter(
        (task) => task.completedAt === null && task.projectId === null,
      ).length,
    [tasks],
  );

  return (
    <div className="grid h-full animate-in grid-cols-[minmax(0,1fr)] duration-700 fade-in-0 lg:grid-cols-[auto_minmax(0,1fr)] lg:pl-6">
      {narrow && open && (
        <div
          aria-hidden
          onClick={() => setPreference('projectsSidebarOpen', false)}
          className="fixed inset-0 z-30 animate-in bg-black/40 duration-200 fade-in-0"
        />
      )}
      <div
        inert={!open}
        className={cn(
          'min-h-0 overflow-hidden transition-[width,opacity,translate] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-[min(300px,85vw)] max-lg:bg-[rgba(10,18,32,.92)] max-lg:pt-[calc(4.5rem+env(safe-area-inset-top))] max-lg:pl-[max(1rem,env(safe-area-inset-left))] max-lg:shadow-[0_0_80px_rgba(0,0,0,.4)] max-lg:ring-1 max-lg:ring-white/10 max-lg:backdrop-blur-2xl',
          open
            ? 'lg:w-[284px]'
            : 'max-lg:-translate-x-full max-lg:opacity-0 lg:w-0 lg:opacity-0',
        )}
      >
        <nav
          id="projects-nav"
          aria-label="Projects"
          className="flex h-full w-[260px] flex-col gap-5 overflow-y-auto pt-4 pb-8 text-sm max-lg:w-full max-lg:pr-4 max-lg:pb-[max(2rem,env(safe-area-inset-bottom))]"
        >
          <ul className="grid gap-0.5">
            <li>
              <Link
                to="/projects"
                activeOptions={{ exact: true }}
                className={listLink}
              >
                <InboxIcon className="size-4 opacity-70" strokeWidth={1.5} />
                Inbox
                {inboxCount > 0 && (
                  <span className="ml-auto text-xs text-foreground/75">
                    {inboxCount}
                  </span>
                )}
              </Link>
            </li>
          </ul>
          <ProjectNav />
        </nav>
      </div>
      <div className="min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
