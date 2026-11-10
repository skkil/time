import { commands } from '@/backend';
import { keys, queryClient } from '@/lib/query';
import { platform } from '@/platform';

const CHECK_EVERY_MS = 5 * 60_000;

let running = false;

async function logEnded() {
  if (running || document.hidden) return;
  running = true;
  try {
    if ((await commands.countEndedBlocks()) === 0) return;
    if ((await commands.logEndedBlocks()) > 0)
      await queryClient.invalidateQueries({ queryKey: keys.allEntries });
    await queryClient.invalidateQueries({ queryKey: keys.allBlocks });
  } catch {
    return;
  } finally {
    running = false;
  }
}

/** Turns focus blocks that have ended into tracked time, on start, on focus and every few minutes. */
export function syncBlockLog() {
  void logEnded();
  window.setInterval(() => void logEnded(), CHECK_EVERY_MS);
  platform().onFocusChange((focused) => {
    if (focused) void logEnded();
  });
}
