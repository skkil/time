import { cn } from '@/lib/utils';

import { projectColorVar } from './tree';

export function ProjectDot({
  color,
  className,
}: {
  color: string | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{
        background: color ? projectColorVar(color) : 'var(--muted-foreground)',
      }}
    />
  );
}
