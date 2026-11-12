import type { Id } from '@/backend';

/**
 * The `before` to send when moving `id` one step within `ids`, or `undefined`
 * when it is already at that end. `null` means "to the end".
 */
export function stepBefore(
  ids: Id[],
  id: Id,
  step: -1 | 1,
): Id | null | undefined {
  const at = ids.indexOf(id);
  if (at === -1 || at + step < 0 || at + step >= ids.length) return undefined;
  return step === -1 ? ids[at - 1] : (ids[at + 2] ?? null);
}
