export type Rgb = [number, number, number];

export type Sky = {
  top: Rgb;
  bottom: Rgb;
  glows: [Rgb, Rgb, Rgb, Rgb];
};

const hex = (value: string): Rgb => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

const sky = (top: string, bottom: string, glows: string[]): Sky => ({
  top: hex(top),
  bottom: hex(bottom),
  glows: glows.map(hex) as Sky['glows'],
});

export const SKIES: { hour: number; sky: Sky }[] = [
  {
    hour: 0,
    sky: sky('#070b1a', '#0d1430', [
      '#26326e',
      '#182c58',
      '#3a2a66',
      '#16405a',
    ]),
  },
  {
    hour: 5,
    sky: sky('#1a1838', '#3a2a48', [
      '#5b3a63',
      '#8a5a6e',
      '#2f3f6e',
      '#c08070',
    ]),
  },
  {
    hour: 8,
    sky: sky('#1f3a5c', '#3d5f7a', [
      '#6a8fb0',
      '#c99a7a',
      '#4f7fa0',
      '#7fb0b8',
    ]),
  },
  {
    hour: 13,
    sky: sky('#1d4466', '#2f6a85', [
      '#4f9cc0',
      '#6bb5b5',
      '#3a7aa8',
      '#8ab8d0',
    ]),
  },
  {
    hour: 17,
    sky: sky('#2a3456', '#5a4058', [
      '#c98a5a',
      '#b0607a',
      '#4a5a8a',
      '#e0a070',
    ]),
  },
  {
    hour: 19.5,
    sky: sky('#1a1a3a', '#3a2448', [
      '#7a3f6a',
      '#c06a5a',
      '#3a3a7a',
      '#5a2f5a',
    ]),
  },
  {
    hour: 22,
    sky: sky('#0a0e22', '#141a38', [
      '#2c3a7a',
      '#1f3660',
      '#43306e',
      '#1a4560',
    ]),
  },
];

const mix = (a: Rgb, b: Rgb, t: number): Rgb =>
  a.map((value, i) => Math.round(value + (b[i] - value) * t)) as Rgb;

const ease = (t: number) => t * t * (3 - 2 * t);

export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24;
  const i = SKIES.findLastIndex((stop) => stop.hour <= h);
  const from = SKIES[i];
  const to = SKIES[(i + 1) % SKIES.length];
  const span = (to.hour > from.hour ? to.hour : to.hour + 24) - from.hour;
  const t = ease((h - from.hour) / span);
  return {
    top: mix(from.sky.top, to.sky.top, t),
    bottom: mix(from.sky.bottom, to.sky.bottom, t),
    glows: from.sky.glows.map((glow, g) =>
      mix(glow, to.sky.glows[g], t),
    ) as Sky['glows'],
  };
}

export const rgb = ([r, g, b]: Rgb, alpha = 1) =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`;
