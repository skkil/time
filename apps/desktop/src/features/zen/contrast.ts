import type { Rgb, Sky } from './sky';

export const INK: Rgb = [241, 241, 238];
export const SHADE: Rgb = [4, 8, 18];
export const SECONDARY_INK = 0.75;
export const MIN_CONTRAST = 4.5;
const GLOW_ALPHA = 0.85;

const channel = (value: number) => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const blend = (a: Rgb, b: Rgb, t: number): Rgb =>
  a.map((value, i) => value + (b[i] - value) * t) as Rgb;

export function contrast(foreground: Rgb, background: Rgb) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}

export function brightestPoint(sky: Sky): Rgb {
  const grounds = [sky.top, sky.bottom];
  const points = [
    ...grounds,
    ...sky.glows.flatMap((glow) =>
      grounds.map((ground) => blend(ground, glow, GLOW_ALPHA)),
    ),
  ];
  return points.reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
}

export function inkContrast(
  background: Rgb,
  shade: number,
  ink = SECONDARY_INK,
) {
  const ground = blend(background, SHADE, shade);
  return contrast(blend(ground, INK, ink), ground);
}

export function readabilityShade(sky: Sky): number {
  const brightest = brightestPoint(sky);
  let shade = 0;
  while (shade < 0.9 && inkContrast(brightest, shade) < MIN_CONTRAST)
    shade += 0.01;
  return Math.round(shade * 100) / 100;
}
