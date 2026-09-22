import type { EventOccurrence } from '@/bindings';
import { useProjectIndex } from '@/features/projects/api';
import { projectColorVar } from '@/features/projects/tree';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { formatClockTime } from '@/lib/time';
import { cn } from '@/lib/utils';

import { useTimeScale } from './scale';

export function EventCard({
  event,
  start,
  end,
  lane,
  lanes,
}: {
  event: EventOccurrence;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}) {
  const index = useProjectIndex();
  const { openTask } = useTaskDialog();
  const project =
    event.projectId === null ? undefined : index.byId.get(event.projectId);
  const tint = project ? projectColorVar(project.color) : 'rgb(148 163 184)';
  const minutes = end - start;
  const scale = useTimeScale();
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => openTask(event.taskId)}
      title={`${event.title} · ${formatClockTime(event.startAt)}–${formatClockTime(event.endAt)}`}
      aria-label={`${event.title}, event ${formatClockTime(event.startAt)} to ${formatClockTime(event.endAt)}`}
      className={cn(
        'absolute z-10 overflow-hidden rounded-md px-2 text-left text-white shadow-[0_1px_0_rgba(255,255,255,.15)_inset] outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        scale.extent(start, start + minutes) < 24
          ? 'py-0 text-[11px] leading-[15px]'
          : 'py-1 text-[12px] leading-tight',
        lanes > 1 &&
          'hover:left-[2px]! hover:z-30 hover:w-[calc(100%-4px)]! hover:shadow-[0_8px_24px_rgba(0,0,0,.35)] focus-visible:left-[2px]! focus-visible:z-30 focus-visible:w-[calc(100%-4px)]!',
      )}
      style={{
        top: scale.top(start),
        height: Math.max(scale.extent(start, start + minutes) - 2, 15),
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        background: `color-mix(in oklab, ${tint} 70%, #0b1220)`,
      }}
    >
      <span className="block truncate font-medium">{event.title}</span>
      {scale.extent(start, start + minutes) >= 32 && (
        <span className="block truncate text-white/75">
          {formatClockTime(event.startAt)}–{formatClockTime(event.endAt)}
          {event.location && ` · ${event.location}`}
        </span>
      )}
    </button>
  );
}
