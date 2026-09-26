import { commands } from '@/backend';
import { queryClient } from '@/lib/query';
import { platform } from '@/platform';

const CHECK_EVERY_MS = 10_000;

async function check() {
  if (document.hidden) return;
  if (await commands.externalChanges()) await queryClient.invalidateQueries();
}

export function syncExternalChanges() {
  void check();
  window.setInterval(() => void check(), CHECK_EVERY_MS);
  platform().onFocusChange((focused) => {
    if (focused) void check();
  });
}
