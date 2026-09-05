import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { InboxIcon, SunsetIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { useTasks } from '@/features/tasks/api';
import { setPreference } from '@/lib/preferences';

import { ProjectNav } from './ProjectNav';

const listLink =
  'flex h-8 items-center gap-2.5 rounded-md px-2 text-foreground/80 outline-none transition-colors hover:bg-white/[.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/40 data-[status=active]:bg-white/[.1] data-[status=active]:text-foreground';

export function ProjectsSpace() {
  const { data: tasks } = useTasks();
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
    <div className="grid h-full animate-in grid-cols-[260px_minmax(0,1fr)] gap-6 pl-6 duration-700 fade-in-0">
      <nav
        aria-label="Projects"
        className="flex min-h-0 flex-col gap-5 overflow-y-auto pt-4 pb-8 text-sm"
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
      <div className="min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
