import type { EngineClient } from '~/engine/client';

const FLUSH_MS = 3_000;
const POLL_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gives waiting changes a moment to reach the server; resolves with how many are still waiting. */
async function flush(engine: EngineClient) {
  await engine.call('syncNow');
  const until = Date.now() + FLUSH_MS;
  for (;;) {
    const { pending, running } = await engine.call('syncState');
    if (pending === 0 || !running || Date.now() >= until) return pending;
    await sleep(POLL_MS);
  }
}

const unsynced = (count: number) =>
  count === 1
    ? '1 change hasn’t synced yet. Signing out removes it from this device. Sign out anyway?'
    : `${count} changes haven’t synced yet. Signing out removes them from this device. Sign out anyway?`;

/**
 * Signing out of a browser leaves nothing behind: after a last sync, the engine forgets the account's rows
 * and sync state. Unsynced changes are only dropped once the user agrees.
 */
export async function signOutLocal(
  engine: EngineClient,
  finish: () => Promise<void>,
  confirm = (message: string) => window.confirm(message),
) {
  const waiting = await flush(engine).catch(() => 0);
  if (waiting > 0 && !confirm(unsynced(waiting))) return;
  await engine.call('forget');
  await finish();
}
