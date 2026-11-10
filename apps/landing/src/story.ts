import { wrapHour } from './sky/bodies';

export type Anchor = { at: number; hour: number };

/** Moves from one hour to the next the short way round the clock, forward on a tie. */
export const blendHours = (from: number, to: number, t: number) => {
  const forward = (((to - from) % 24) + 24) % 24;
  const delta = forward > 12 ? forward - 24 : forward;
  return wrapHour(from + delta * t);
};

const ease = (t: number) => t * t * (3 - 2 * t);

/** The sky's hour at scroll position `y`, holding still around each anchor. */
export function hourAt(anchors: Anchor[], y: number): number {
  if (y <= anchors[0].at) return anchors[0].hour;
  for (let i = 1; i < anchors.length; i++) {
    const from = anchors[i - 1];
    const to = anchors[i];
    if (y <= to.at) {
      const t = (y - from.at) / (to.at - from.at);
      return blendHours(from.hour, to.hour, ease(t));
    }
  }
  return anchors[anchors.length - 1].hour;
}
