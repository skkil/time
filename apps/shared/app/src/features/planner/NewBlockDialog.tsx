import type { Task } from '@/backend';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskCommand } from '@/features/tasks/TaskPicker';
import { EMPTY_TASK, useCreateTask } from '@/features/tasks/api';
import { type DateKey, formatDayLabel, formatMinutesOfDay } from '@/lib/time';

export type BlockSlot = { day: DateKey; start: number; end: number | null };

export function NewBlockDialog({
  slot,
  onClose,
  onPick,
}: {
  slot: BlockSlot | null;
  onClose: () => void;
  onPick: (task: Task, slot: BlockSlot) => void;
}) {
  const create = useCreateTask();

  return (
    <Dialog open={slot !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {slot && (
          <>
            <DialogHeader className="border-b p-4">
              <DialogTitle>
                Plan {formatDayLabel(slot.day)}
                {slot.end === null
                  ? ` at ${formatMinutesOfDay(slot.start)}`
                  : `, ${formatMinutesOfDay(slot.start)}–${formatMinutesOfDay(slot.end % (24 * 60))}`}
              </DialogTitle>
              <DialogDescription>
                Pick a task, or type a new one.
              </DialogDescription>
            </DialogHeader>
            <TaskCommand
              autoFocus
              placeholder="Find or create a task"
              onSelect={(task) => onPick(task, slot)}
              onCreate={(title) =>
                create.mutate(
                  {
                    ...EMPTY_TASK,
                    title,
                    estimateMinutes:
                      slot.end === null ? null : slot.end - slot.start,
                  },
                  { onSuccess: (task) => onPick(task, slot) },
                )
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
