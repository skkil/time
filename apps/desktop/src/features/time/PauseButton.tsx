import { PauseIcon, PlayIcon } from 'lucide-react';

import type { RunningTimer } from '@/bindings';
import { Hint } from '@/components/ui/tooltip';
import { useNow } from '@/hooks/use-now';
import { formatStopwatch } from '@/lib/time';

import { usePauseTimer } from './api';

export function PauseButton({
  timer,
  compact = false,
}: {
  timer: RunningTimer;
  compact?: boolean;
}) {
  const toggle = usePauseTimer();
  const paused = timer.pausedAt !== null;
  const Icon = paused ? PlayIcon : PauseIcon;
  const label = paused ? 'Resume focus' : 'Take a break';

  if (compact)
    return (
      <Hint label={label}>
        <button
          type="button"
          aria-label={label}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(paused)}
          className="grid size-6 place-items-center rounded-full text-foreground outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5"
        >
          <Icon className="fill-current" />
        </button>
      </Hint>
    );

  return (
    <button
      type="button"
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(paused)}
      className="ml-4 flex h-9 items-center gap-2 rounded-full px-4 text-sm ring-1 ring-white/20 transition-colors hover:bg-white/10"
    >
      <Icon className="size-3.5 fill-current" />
      {paused ? 'Resume' : 'Break'}
    </button>
  );
}

export function BreakNote({ timer }: { timer: RunningTimer }) {
  const now = useNow(1000, timer.pausedAt !== null);
  if (timer.pausedAt === null) return null;
  return (
    <span className="text-sm text-foreground/75 tabular-nums">
      On a break · {formatStopwatch(now - timer.pausedAt)}
    </span>
  );
}
