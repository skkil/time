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

/**
 * Moves `id` before `before` (to the end when `null`) among `rows`, the
 * siblings in their current order, and numbers them from 1 as the backends do.
 */
export function renumber<T extends { id: Id; position: number }>(
  rows: T[],
  id: Id,
  before: Id | null,
): T[] {
  const moving = rows.find((row) => row.id === id);
  if (!moving) return rows;
  const rest = rows.filter((row) => row.id !== id);
  const at = rest.findIndex((row) => row.id === before);
  rest.splice(at === -1 ? rest.length : at, 0, moving);
  return rest.map((row, index) => ({ ...row, position: index + 1 }));
}
