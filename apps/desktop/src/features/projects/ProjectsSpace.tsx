import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { InboxIcon, SunsetIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { useTasks } from '@/features/tasks/api';
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

  useEffect(() => {
    const rest = pathname.replace(/^\/projects\/?/, '');
    setPreference('lastProject', rest === '' ? 'inbox' : rest);
  }, [pathname]);

  const counts = useMemo(() => {
    const open = (tasks ?? []).filter((task) => task.completedAt === null);
    return {
      inbox: open.filter((task) => task.projectId === null && !task.someday)
        .length,
      someday: open.filter((task) => task.someday).length,
    };
  }, [tasks]);

  return (
    <div className="grid h-full animate-in grid-cols-[auto_minmax(0,1fr)] pl-6 duration-700 fade-in-0">
      <div
        inert={!open}
        className={cn(
          'min-h-0 overflow-hidden transition-[width,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
          open ? 'w-[284px]' : 'w-0 opacity-0',
        )}
      >
        <nav
          id="projects-nav"
          aria-label="Projects"
          className="flex h-full w-[260px] flex-col gap-5 overflow-y-auto pt-4 pb-8 text-sm"
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
                {counts.inbox > 0 && (
                  <span className="ml-auto text-xs text-foreground/50">
                    {counts.inbox}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link to="/projects/someday" className={listLink}>
                <SunsetIcon className="size-4 opacity-70" strokeWidth={1.5} />
                Someday
                {counts.someday > 0 && (
                  <span className="ml-auto text-xs text-foreground/50">
                    {counts.someday}
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
