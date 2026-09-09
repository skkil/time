import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type DateKey, shiftKey, todayKey, weekStartOf } from '@/lib/time';
import { cn } from '@/lib/utils';

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  meta,
  actions,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode | ReactNode[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-col gap-4 px-8 pt-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl leading-tight font-light tracking-tight">
            {title}
          </h1>
          {meta && <PageMeta items={Array.isArray(meta) ? meta : [meta]} />}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

function PageMeta({ items }: { items: ReactNode[] }) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
      {items.filter(Boolean).map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </p>
  );
}

export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto px-8 py-6', className)}>
      {children}
    </div>
  );
}

export function WeekSwitcher({
  week,
  onChange,
}: {
  week: DateKey;
  onChange: (week: DateKey) => void;
}) {
  const current = weekStartOf(todayKey());
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => onChange(shiftKey(week, -7))}
          >
            <ChevronLeftIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous week</TooltipContent>
      </Tooltip>
      <Button
        variant="outline"
        size="sm"
        disabled={week === current}
        onClick={() => onChange(current)}
      >
        This week
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => onChange(shiftKey(week, 7))}
          >
            <ChevronRightIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next week</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-2 rounded-md border border-dashed px-5 py-6 text-sm',
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {children && (
        <p className="max-w-prose text-muted-foreground">{children}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-base font-medium">{children}</h2>
      {aside && <div className="text-sm text-muted-foreground">{aside}</div>}
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <span className="text-foreground">{value}</span> {label}
    </span>
  );
}
