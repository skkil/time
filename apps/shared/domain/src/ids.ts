import type { Id } from '@skkil-time/contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Whether text is an entity id: a lowercase hyphenated UUID. */
export function isId(text: string): text is Id {
  return UUID.test(text);
}
