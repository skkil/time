import { createLocalBackend } from '@skkil-time/client/local';

import { deferredEngine } from '@/core/local/deferred-engine';
import { deviceCommands } from '@/core/local/device-commands';
import { replica } from '@/core/local/replica';
import { notifyWrite } from '@/core/local/writes';

/** Every app command, answered by the phone's replica. */
export const commands = createLocalBackend(
  deferredEngine(async () => (await replica()).engine, notifyWrite),
  deviceCommands,
);
