import { queryClient } from '@/core/api/query-client';

const BURST_MS = 150;

let burst: ReturnType<typeof setTimeout> | undefined;

/** Refetches every query once a burst of synced changes has settled. */
export function refreshSoon() {
  clearTimeout(burst);
  burst = setTimeout(() => void queryClient.invalidateQueries(), BURST_MS);
}
