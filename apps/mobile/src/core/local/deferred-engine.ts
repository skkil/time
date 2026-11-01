import type { Engine } from '@skkil-time/local';

/**
 * An engine usable before the replica has opened: every call waits for
 * `opened`, and `onWrite` hears about each applied mutation (to push it).
 */
export function deferredEngine(
  opened: () => Promise<Engine>,
  onWrite: () => void = () => undefined,
): Engine {
  return {
    async mutate(name, args) {
      const result = await (await opened()).mutate(name, args);
      onWrite();
      return result;
    },
    query: async (name, args) => (await opened()).query(name, args),
  };
}
