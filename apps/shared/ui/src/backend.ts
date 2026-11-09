import type { commands as contract } from '@skkil-time/client/types';

export type * from '@skkil-time/client/types';

export type Backend = typeof contract;

let installed: Backend | null = null;

export function installBackend(backend: Backend) {
  installed = backend;
}

export const commands = new Proxy({} as Backend, {
  get(_, name) {
    if (!installed) throw new Error('No backend installed');
    return installed[name as keyof Backend];
  },
});
