import type { CSSProperties } from 'react';

export const cardColors = (tint: string): CSSProperties => {
  const fill = `color-mix(in oklab, ${tint} var(--block-tint), var(--card))`;
  return {
    background: `linear-gradient(${fill}, ${fill}), var(--card-under, transparent)`,
    borderColor: `color-mix(in oklab, ${tint} var(--block-edge), var(--card))`,
    borderLeft: `3px solid ${tint}`,
  };
};

export const TRACKED_LOOK = 'opacity-75 grayscale-[.45]';
