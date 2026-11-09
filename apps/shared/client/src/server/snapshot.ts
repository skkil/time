import type { TaskSnapshot as WireSnapshot } from '#server/api';
import type { TaskSnapshot } from '#types/bindings';

/**
 * The server documents a snapshot's tuples (`created`, `dependencies`,
 * `links`) as objects but sends them as JSON arrays, exactly as the
 * contract types them, so the payload passes through unchanged.
 */
export const fromWire = (snapshot: WireSnapshot) =>
  snapshot as unknown as TaskSnapshot;

export const toWire = (snapshot: TaskSnapshot) =>
  snapshot as unknown as WireSnapshot;
