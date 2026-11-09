import initWasm, { TimeCore } from '@skkil-time/core-wasm';
import { createSyncAccount } from '@skkil-time/client/sync';
import { createEngineHost } from '~/engine/worker/engine-host';
import type { OpenOptions } from '~/engine/worker/router';
import { SyncRunner } from '~/engine/worker/sync-runner';

const DATABASE = 'time.db';

/** Why this browser can't keep the database, or null when it can. */
export async function probeStorage(): Promise<string | null> {
  if (!('locks' in navigator))
    return 'This browser can’t share offline data between tabs.';
  try {
    await navigator.storage.getDirectory();
    return null;
  } catch {
    return 'This browser doesn’t allow offline storage here, as in a private window.';
  }
}

/** Loads the engine, opens the database on OPFS and serves it with the sync runner. */
export async function openEngine({ apiUrl, host, emit }: OpenOptions) {
  await initWasm();
  const core = await TimeCore.open(DATABASE);
  const runner = new SyncRunner({
    core,
    account: createSyncAccount({ apiUrl, getAccessToken: host.accessToken }),
    report: (state) => emit({ kind: 'sync', state }),
    onChange: (tables) => emit({ kind: 'changed', tables, source: null }),
  });
  return createEngineHost({ core, runner, emit });
}
