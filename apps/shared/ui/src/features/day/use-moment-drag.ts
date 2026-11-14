import { type PointerEvent, useRef, useState } from 'react';

import { DAY_MINUTES, clamp, snap } from '@/features/planner/geometry';
import type { TimeScale } from '@/features/planner/time-scale';

const DRAG_THRESHOLD_PX = 4;

export type MomentDrag = { key: string; start: number };

/** Drags a timeline row up or down; reports the new start in minutes into the day. */
export function useMomentDrag({
  scale,
  onDrop,
}: {
  scale: TimeScale;
  onDrop: (key: string, start: number) => void;
}) {
  const [drag, setDrag] = useState<MomentDrag | null>(null);
  const dragged = useRef(false);

  const begin = (
    key: string,
    start: number,
    length: number,
    event: PointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) return;
    if ((event.target as Element).closest('[role=checkbox], a')) return;
    const startY = event.clientY;
    const origin = scale.top(start);
    const latest = { start, moving: false };
    dragged.current = false;

    const move = (next: globalThis.PointerEvent) => {
      const offset = next.clientY - startY;
      if (!latest.moving && Math.abs(offset) < DRAG_THRESHOLD_PX) return;
      latest.moving = true;
      dragged.current = true;
      latest.start = clamp(
        snap(scale.minuteAt(origin + offset)),
        0,
        DAY_MINUTES - Math.max(length, 0),
      );
      setDrag({ key, start: latest.start });
    };
    const stop = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setDrag(null);
      if (commit && latest.moving && latest.start !== start)
        onDrop(key, latest.start);
    };
    const up = () => stop(true);
    const cancel = () => stop(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  /** True once after a drag, so the click that ends it doesn't open the task. */
  const consumeDrag = () => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  };

  return { drag, begin, consumeDrag };
}
