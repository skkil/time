import { ArchiveIcon, PencilIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Habit } from '@/bindings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { fromDateKey, todayKey } from '@/lib/time';

import { NewHabitMenu, SyncNotice } from './HabitControls';
import { HabitDialog, type HabitDialogState } from './HabitDialog';
import { useArchiveHabit, useHabitSync, useHabits } from './api';
import { TIMES_OF_DAY } from './meta';

const weeksRun = (habit: Habit) =>
  Math.max(
    1,
    Math.round(
      (fromDateKey(todayKey()).getTime() -
        fromDateKey(habit.startDate).getTime()) /
        (7 * 86_400_000),
    ),
  );

export function HabitsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: habits = [], isPending } = useHabits();
  const sync = useHabitSync();
  const archive = useArchiveHabit();
  const [dialog, setDialog] = useState<HabitDialogState>(null);
  const [retiring, setRetiring] = useState<Habit | null>(null);
  const areas = useMemo(
    () => [...new Set(habits.map((h) => h.area).filter(Boolean))].sort(),
    [habits],
  );
  const ordered = [...habits].sort(
    (a, b) =>
      TIMES_OF_DAY.findIndex((t) => t.value === a.timeOfDay) -
      TIMES_OF_DAY.findIndex((t) => t.value === b.timeOfDay),
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) void sync.refetch();
          onOpenChange(next);
        }}
      >
        <DialogContent className="flex max-h-[80vh] flex-col gap-6 rounded-[32px] border-0 bg-[rgba(10,18,32,.92)] p-10 ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <DialogTitle className="text-3xl font-light">Habits</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-foreground/50">
                Retiring a habit is a normal ending, not a failure.
              </DialogDescription>
            </div>
            <NewHabitMenu
              onPick={(kind) => setDialog({ mode: 'create', kind })}
            />
          </div>
          <SyncNotice
            report={sync.data}
            habits={habits}
            syncing={sync.isFetching}
            onRetry={() => sync.refetch()}
          />
          {habits.length === 0 && !isPending ? (
            <p className="py-6 text-foreground/55">
              No habits yet. Build something new, or break a bad habit.
            </p>
          ) : (
            <ul className="-mx-2 min-h-0 overflow-y-auto">
              {ordered.map((habit) => (
                <li
                  key={habit.id}
                  className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[.05]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">{habit.name}</p>
                    <p className="truncate text-xs text-foreground/45">
                      {[
                        habit.kind === 'build'
                          ? 'Build'
                          : habit.kind === 'quit'
                            ? 'Quit'
                            : 'Limit',
                        TIMES_OF_DAY.find((t) => t.value === habit.timeOfDay)
                          ?.label,
                        habit.anchor && `after ${habit.anchor}`,
                        habit.dueDays > 0 &&
                          `${habit.doneDays} of last ${habit.dueDays} days`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Edit ${habit.name}`}
                    onClick={() => setDialog({ mode: 'edit', habit })}
                    className="grid size-8 place-items-center rounded-full text-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-foreground focus-visible:opacity-100"
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Archive ${habit.name}`}
                    onClick={() => setRetiring(habit)}
                    className="grid size-8 place-items-center rounded-full text-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-foreground focus-visible:opacity-100"
                  >
                    <ArchiveIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      <HabitDialog
        state={dialog}
        areas={areas}
        onClose={() => setDialog(null)}
      />
      <AlertDialog
        open={retiring !== null}
        onOpenChange={(next) => !next && setRetiring(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire “{retiring?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              You ran this {retiring && weeksRun(retiring)}{' '}
              {retiring && weeksRun(retiring) === 1 ? 'week' : 'weeks'}. Its
              history stays in your reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => retiring && archive.mutate(retiring.id)}
            >
              Retire
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
