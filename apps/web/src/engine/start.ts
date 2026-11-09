import type { Engine } from '@skkil-time/client/local';
import { type EngineClient, connectEngine } from '~/engine/client';
import type { HostApi } from '~/engine/protocol';

export type StartedEngine = EngineClient & { stop(): void };

/** Starts this tab's engine worker. */
export function startEngine(apiUrl: string, host: HostApi): StartedEngine {
  const worker = new Worker(new URL('./worker/entry.ts', import.meta.url), {
    type: 'module',
    name: 'skkil-time-engine',
  });
  return {
    ...connectEngine(worker, host, apiUrl),
    stop: () => worker.terminate(),
  };
}

/** The engine as `createLocalBackend` takes it. */
export const localEngine = (client: EngineClient): Engine => ({
  mutate: (name, args) => client.call('mutate', name, args),
  query: (name, args) => client.call('query', name, args),
});
