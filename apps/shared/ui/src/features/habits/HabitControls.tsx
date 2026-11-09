import { BanIcon, PlusIcon, RefreshCwIcon, RepeatIcon } from 'lucide-react';

import type { Habit, SyncReport } from '@/backend';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function NewHabitMenu({
  onPick,
}: {
  onPick: (kind: 'build' | 'quit') => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          New habit
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => onPick('build')}>
          <RepeatIcon />
          Build a good habit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick('quit')}>
          <BanIcon />
          Break a bad habit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SyncNotice({
  report,
  habits,
  syncing,
  onRetry,
}: {
  report: SyncReport | undefined;
  habits: Habit[];
  syncing: boolean;
  onRetry: () => void;
}) {
  const uses = (source: string) =>
    habits.some((habit) => habit.tracking?.source === source);
  if (!report) return null;
  let message: string | null = null;
  if (report.activitywatch === 'unreachable')
    message =
      'ActivityWatch isn’t running, so website and app tracking is paused. Start it and these habits update on their own.';
  else if (
    report.activitywatch === 'connected' &&
    uses('website') &&
    !report.hasWebData
  )
    message =
      'ActivityWatch has no browser data yet. Install the aw-watcher-web extension in your browser.';
  else if (
    report.activitywatch === 'connected' &&
    uses('app') &&
    !report.hasWindowData
  )
    message =
      'ActivityWatch has no window data yet. On Hyprland, run awatcher as the window watcher.';
  if (!message) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-md border border-dashed px-4 py-3 text-sm"
    >
      <span className="flex-1 text-muted-foreground">{message}</span>
      <Button variant="outline" size="sm" disabled={syncing} onClick={onRetry}>
        <RefreshCwIcon className={cn(syncing && 'animate-spin')} />
        Check again
      </Button>
    </div>
  );
}
