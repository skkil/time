import { type NativeCore, createNativeCore } from './core';
import { guardAsync } from './errors';
import { open } from './native';

export type { Binding, NativeCore, SyncIssue, SyncState } from './core';
export type { CommandError } from './errors';

/** Opens (and migrates) the SQLite replica at `path` on its own thread. */
export const openCore = (path: string): Promise<NativeCore> =>
  guardAsync(async () => createNativeCore(await open(path)));
