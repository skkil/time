import { queryClient } from '@/core/api/query-client';

const BURST_MS = 150;

let burst: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

/** Refetches every query once a burst of synced changes has settled. */
export function refreshSoon() {
  clearTimeout(burst);
  burst = setTimeout(() => {
    void queryClient.invalidateQueries();
    listeners.forEach((listener) => listener());
  }, BURST_MS);
}

export function onSyncedChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
