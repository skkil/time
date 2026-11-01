import { type NativeCore, openCore } from '@skkil-time/core-native';

import { databasePath } from '@/core/local/database-path';

let opening: Promise<NativeCore> | null = null;

/** The phone's replica, opened on first use and kept for the app's lifetime. */
export function replica(): Promise<NativeCore> {
  opening ??= openCore(databasePath()).catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}
