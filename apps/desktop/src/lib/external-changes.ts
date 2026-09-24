import { getCurrentWindow } from '@tauri-apps/api/window';

import { commands } from '@/bindings';

import { queryClient } from './query';

const CHECK_EVERY_MS = 10_000;

async function check() {
  if (document.hidden) return;
  if (await commands.externalChanges()) await queryClient.invalidateQueries();
}

export function syncExternalChanges() {
  void check();
  window.setInterval(() => void check(), CHECK_EVERY_MS);
  void getCurrentWindow().onFocusChanged(({ payload: focused }) => {
    if (focused) void check();
  });
}
