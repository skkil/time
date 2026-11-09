import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A native `<details>` with the app's chevron instead of the browser's
 * marker, which WebKitGTK draws as an emoji.
 */
export function Disclosure({
  summary,
  className,
  summaryClassName,
  children,
}: {
  summary: ReactNode;
  className?: string;
  summaryClassName?: string;
  children: ReactNode;
}) {
  return (
    <details className={cn('group', className)}>
      <summary
        className={cn(
          'flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden',
          summaryClassName,
        )}
      >
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        {summary}
      </summary>
      {children}
    </details>
  );
}
