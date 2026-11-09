import {
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from 'react';

import type { DateKey } from '@/lib/time';

const COMMIT_PX = 80;
const FOLLOW = 0.35;
const GESTURE_GAP_MS = 180;
const SLIDE_PX = 56;
const EASE = 'cubic-bezier(.2,.8,.2,1)';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useWeekSwipe(
  ref: RefObject<HTMLElement | null>,
  week: DateKey,
  onStep: (step: 1 | -1) => void,
) {
  const gesture = useRef({ delta: 0, locked: false, timer: 0 });
  const shown = useRef(week);

  const end = useEffectEvent(() => {
    const el = ref.current;
    const { locked } = gesture.current;
    gesture.current = { delta: 0, locked: false, timer: 0 };
    if (!el || locked || !el.style.transform) return;
    const from = el.style.transform;
    el.style.transform = '';
    if (!calm())
      el.animate([{ transform: from }, { transform: 'translateX(0)' }], {
        duration: 220,
        easing: EASE,
      });
  });

  const onWheel = useEffectEvent((event: WheelEvent) => {
    const dx = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    const sideways =
      event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (!sideways || dx === 0) return;
    event.preventDefault();

    const current = gesture.current;
    clearTimeout(current.timer);
    current.timer = window.setTimeout(end, GESTURE_GAP_MS);
    if (current.locked) return;

    current.delta +=
      event.deltaMode === WheelEvent.DOM_DELTA_LINE ? dx * 16 : dx;
    if (Math.abs(current.delta) >= COMMIT_PX) {
      current.locked = true;
      onStep(current.delta > 0 ? 1 : -1);
    } else if (ref.current && !calm()) {
      ref.current.style.transform = `translateX(${-current.delta * FOLLOW}px)`;
    }
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(gesture.current.timer);
    };
  }, [ref]);

  useLayoutEffect(() => {
    const el = ref.current;
    const previous = shown.current;
    shown.current = week;
    if (!el || previous === week) return;
    el.style.transform = '';
    if (calm()) return;
    const offset = week > previous ? SLIDE_PX : -SLIDE_PX;
    el.animate(
      [
        { transform: `translateX(${offset}px)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 260, easing: EASE },
    );
  }, [ref, week]);
}
