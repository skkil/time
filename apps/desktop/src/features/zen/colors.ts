export type Rgb = [number, number, number];

export const ZEN_TOKENS = [
  '--zen-sky',
  '--zen-shallow',
  '--zen-mid',
  '--zen-deep',
] as const;

const CROSSFADE_MS = 1000;

let probe: CanvasRenderingContext2D | null | undefined;

function parseColor(value: string): Rgb {
  probe ??= document
    .createElement('canvas')
    .getContext('2d', { willReadFrequently: true });
  if (!probe || !value.trim()) return [0, 0, 0];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = value.trim();
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

export function readZenColors(element: Element): Rgb[] {
  const style = getComputedStyle(element);
  return ZEN_TOKENS.map((token) => parseColor(style.getPropertyValue(token)));
}

const ease = (x: number) => x * x * (3 - 2 * x);

export function createPalette(initial: Rgb[]) {
  let from = initial;
  let to = initial;
  let startedAt = -Infinity;

  const at = (now: number): Rgb[] => {
    const progress = Math.min(1, Math.max(0, (now - startedAt) / CROSSFADE_MS));
    if (progress >= 1) return to;
    const k = ease(progress);
    return to.map(
      (color, i) =>
        color.map(
          (channel, c) => from[i][c] + (channel - from[i][c]) * k,
        ) as Rgb,
    );
  };

  return {
    at,
    fadeTo(colors: Rgb[], now: number) {
      from = at(now);
      to = colors;
      startedAt = now;
    },
    snapTo(colors: Rgb[]) {
      from = colors;
      to = colors;
      startedAt = -Infinity;
    },
  };
}
