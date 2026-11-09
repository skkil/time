import type { Task, TimeBlock } from '@/backend';
import type { DateKey } from '@/lib/time';

import { DEFAULT_BLOCK_MINUTES } from './geometry';

export function plannedSeconds(
  blocks: TimeBlock[],
  tasks: Task[],
  from: DateKey,
  to: DateKey,
) {
  const blocked = new Set(blocks.map((block) => block.taskId));
  const fromBlocks = blocks.reduce(
    (sum, block) => sum + block.endAt - block.startAt,
    0,
  );
  const fromTimes = tasks
    .filter(
      (task) =>
        task.kind === 'task' &&
        task.dueTime !== null &&
        task.dueDate !== null &&
        task.dueDate >= from &&
        task.dueDate < to &&
        !blocked.has(task.id),
    )
    .reduce(
      (sum, task) => sum + (task.estimateMinutes ?? DEFAULT_BLOCK_MINUTES) * 60,
      0,
    );
  return fromBlocks + fromTimes;
}
