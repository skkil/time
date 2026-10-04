import { commands } from '@/backend';
import { queryClient } from '@/lib/query';
import { platform } from '@/platform';

const CHECK_EVERY_MS = 10_000;
const LIVE_CHECK_EVERY_MS = 60_000;
const BURST_MS = 150;

async function check() {
  if (document.hidden) return;
  if (await commands.externalChanges()) await queryClient.invalidateQueries();
}

let burst: number | undefined;

function refetchSoon() {
  window.clearTimeout(burst);
  burst = window.setTimeout(
    () => void queryClient.invalidateQueries(),
    BURST_MS,
  );
}

export function syncExternalChanges() {
  const live = platform().onRemoteChange;
  void check();
  window.setInterval(
    () => void check(),
    live ? LIVE_CHECK_EVERY_MS : CHECK_EVERY_MS,
  );
  live?.((change) => {
    if (change.topic !== 'preferences') refetchSoon();
  });
  platform().onFocusChange((focused) => {
    if (focused) void check();
  });
}
