import type { RealtimeStatus } from '@skkil-time/api/realtime';

const UNREACHABLE_AFTER_MS = 5_000;
const listeners = new Set<(down: boolean) => void>();
let down = false;

export const isDown = () => down;

let timer: ReturnType<typeof setTimeout> | undefined;

const publish = (next: boolean) => {
  if (next === down) return;
  down = next;
  listeners.forEach((listener) => listener(next));
};

/** Fed by the live connection: a socket that stays closed means the server can't be reached. */
export function reportRealtime(status: RealtimeStatus) {
  if (status === 'open') {
    clearTimeout(timer);
    timer = undefined;
    return publish(false);
  }
  if (status === 'closed' && timer === undefined)
    timer = setTimeout(() => publish(true), UNREACHABLE_AFTER_MS);
}

export function subscribeConnection(listener: (down: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
