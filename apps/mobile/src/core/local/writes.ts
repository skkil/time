const listeners = new Set<() => void>();

/** Called after every local write, so sync can push it. */
export const notifyWrite = () => listeners.forEach((listener) => listener());

export function onWrite(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
