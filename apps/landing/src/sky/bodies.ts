export type Vec3 = [number, number, number];

const SUNRISE = 6.5;
const DAY_LENGTH = 12;
const SUN_PEAK = (50 * Math.PI) / 180;
const SUN_SWING = (70 * Math.PI) / 180;
const MOON_PEAK = (42 * Math.PI) / 180;
const MOON_SWING = (55 * Math.PI) / 180;

export const wrapHour = (hour: number) => ((hour % 24) + 24) % 24;

const orbit = (angle: number, peak: number, swing: number): Vec3 => {
  const elevation = Math.asin(Math.sin(angle) * Math.sin(peak));
  const azimuth = -Math.cos(angle) * swing;
  return [
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  ];
};

const dayAngle = (hour: number) =>
  ((wrapHour(hour) - SUNRISE) / DAY_LENGTH) * Math.PI;

export const sunDirection = (hour: number): Vec3 =>
  orbit(dayAngle(hour), SUN_PEAK, SUN_SWING);

export const moonDirection = (hour: number): Vec3 =>
  orbit(dayAngle(hour) + Math.PI, MOON_PEAK, MOON_SWING);

const smoothstep = (from: number, to: number, x: number) => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

export const nightAmount = (sun: Vec3) => smoothstep(0.02, -0.22, sun[1]);

const OPTICAL_DEPTH: Vec3 = [0.062, 0.118, 0.27];

/** Sunlight left after crossing the air at this sun height (Kasten–Young air mass). */
export function sunlight(sun: Vec3): Vec3 {
  const elevation = Math.asin(sun[1]);
  if (elevation < -0.09) return [0, 0, 0];
  const zenith = 90 - (Math.max(elevation, 0) * 180) / Math.PI;
  const airMass = Math.min(
    1 /
      (Math.cos((zenith * Math.PI) / 180) +
        0.50572 * Math.pow(96.07995 - zenith, -1.6364)),
    40,
  );
  const fade = smoothstep(-0.09, 0.01, elevation);
  return OPTICAL_DEPTH.map(
    (depth) => Math.exp(-depth * airMass) * fade,
  ) as Vec3;
}

export type Phase =
  'Night' | 'Dawn' | 'Morning' | 'Midday' | 'Afternoon' | 'Sunset' | 'Evening';

export function phaseOf(hour: number): Phase {
  const h = wrapHour(hour);
  if (h < 5) return 'Night';
  if (h < 7.5) return 'Dawn';
  if (h < 11.5) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < 17.5) return 'Afternoon';
  if (h < 19.5) return 'Sunset';
  if (h < 22.5) return 'Evening';
  return 'Night';
}

export const clockLabel = (hour: number) => {
  const minutes = Math.floor(wrapHour(hour) * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
};
