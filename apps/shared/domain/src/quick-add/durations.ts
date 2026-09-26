import { parseDurationInput } from '#time';

const MAX_MINUTES = 24 * 60;

export const DURATION_PATTERN = String.raw`for\s+(\d+(?:\.\d+)?\s*h(?:ours?|rs?)?(?:\s*\d+\s*m(?:in(?:utes?)?)?)?|\d+\s*m(?:in(?:utes?)?)?)`;

export function parseDuration(amount: string) {
  const normalized = amount
    .toLowerCase()
    .replace(/hours?|hrs?/, 'h')
    .replace(/min(utes?)?/, 'm');
  const minutes = parseDurationInput(normalized);
  return minutes === null || minutes > MAX_MINUTES ? undefined : minutes;
}
