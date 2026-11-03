import type { RemoteHost } from '@skkil-time/remote';
import { browserFiles } from '~/platform/files';

/** The browser as the remote backend's host, for browsers that can't keep data offline. */
export function webHost(): RemoteHost {
  return { clientId: crypto.randomUUID(), ...browserFiles };
}
