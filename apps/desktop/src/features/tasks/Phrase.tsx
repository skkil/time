import { type ComponentProps, forwardRef } from 'react';

import { cn } from '@/lib/utils';

export const Phrase = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { set: boolean }
>(function Phrase({ set, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        '-mx-1 rounded-md px-1 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-white/40',
        set ? 'text-foreground/80' : 'text-foreground/75',
        className,
      )}
      {...props}
    />
  );
});

export function Dot() {
  return <span className="text-foreground/25">·</span>;
}
