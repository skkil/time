import { Link, Outlet } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { mondayOf, todayKey } from '@/lib/time';
import { cn } from '@/lib/utils';

export function ReportsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 pt-2 pb-24">
        <Link
          to="/"
          search={{ view: 'day', week: mondayOf(todayKey()) }}
          className="inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Day
        </Link>
        <Outlet />
      </div>
    </div>
  );
}

export function ReportSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('grid gap-3', className)}>
      <h2 className="text-xs tracking-wide text-foreground/45">{title}</h2>
      {children}
    </section>
  );
}
