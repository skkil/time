import { type PointerEvent, useState } from 'react';

import type { DateKey } from '@/lib/time';

import { SNAP_MINUTES, rangeBetween, slotAtOffset } from './geometry';

export type RangeSelection = { day: DateKey; start: number; end: number };

const DRAG_THRESHOLD_PX = 4;

export function useRangeSelect({
  onSelect,
  onClick,
}: {
  onSelect: (range: RangeSelection) => void;
  onClick: (day: DateKey, minutes: number) => void;
}) {
  const [selection, setSelection] = useState<RangeSelection | null>(null);

  const begin = (day: DateKey, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.preventDefault();
    const column = event.currentTarget;
    const startY = event.clientY;
    const slotAt = (clientY: number) =>
      slotAtOffset(clientY - column.getBoundingClientRect().top);
    const anchor = slotAt(startY);
    let dragging = false;
    let lastY = startY;

    const update = () => {
      const range = { day, ...rangeBetween(anchor, slotAt(lastY)) };
      setSelection(range);
      return range;
    };
    const onMove = (move: globalThis.PointerEvent) => {
      lastY = move.clientY;
      if (!dragging && Math.abs(lastY - startY) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      update();
    };
    const onScroll = () => dragging && update();
    const finish = (up: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('scroll', onScroll, true);
      if (!dragging) {
        setSelection(null);
        onClick(day, anchor);
        return;
      }
      lastY = up.clientY;
      const range = update();
      if (range.end - range.start >= SNAP_MINUTES) onSelect(range);
    };
    const cancel = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('scroll', onScroll, true);
      setSelection(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('scroll', onScroll, true);
  };

  return { selection, begin, clear: () => setSelection(null) };
}
