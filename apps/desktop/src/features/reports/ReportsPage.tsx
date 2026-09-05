import { Link, Outlet } from '@tanstack/react-router';

import { mondayOf, todayKey } from '@/lib/time';

const tab =
  'flex h-9 items-center border-b-2 border-transparent px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:border-primary data-[status=active]:font-semibold data-[status=active]:text-foreground';

export function ReportsPage() {
  const week = mondayOf(todayKey());
  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      <nav aria-label="Reports" className="flex gap-6 px-8">
        <Link to="/reports/reviews" className={tab}>
          Reviews
        </Link>
        <Link
          to="/reports/time"
          search={{ week }}
          className={tab}
          activeOptions={{ includeSearch: false }}
        >
          Time
        </Link>
        <Link
          to="/reports/habits"
          search={{ week }}
          className={tab}
          activeOptions={{ includeSearch: false }}
        >
          Habits
        </Link>
      </nav>
      <div className="min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
