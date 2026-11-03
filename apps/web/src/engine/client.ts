import { toEngineError } from '~/engine/errors';
import type {
  EngineApi,
  EngineEvent,
  FromWorker,
  HostApi,
  Method,
  Result,
  ToWorker,
} from '~/engine/protocol';

/** The page's end of the engine worker: a `Worker`, or a `MessagePort` in tests. */
export type EnginePort = {
  postMessage(message: ToWorker): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<FromWorker>) => void,
  ): void;
};

/** The engine can't run in this browser: no OPFS sync access handles (private windows, old browsers). */
export class EngineUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'EngineUnavailable';
  }
}

export type EngineClient = {
  /** Resolves once the worker can serve calls: it owns the database, or found the tab that does. */
  ready: Promise<'leader' | 'follower'>;
  call<M extends Method>(
    method: M,
    ...args: Parameters<EngineApi[M]>
  ): Promise<Result<M>>;
  onEvent(listener: (event: EngineEvent) => void): () => void;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

/** Talks to the engine worker: calls by name, answers its questions about the session, relays its events. */
export function connectEngine(
  port: EnginePort,
  host: HostApi,
  apiUrl: string,
): EngineClient {
  const pending = new Map<number, Pending>();
  const listeners = new Set<(event: EngineEvent) => void>();
  let next = 0;
  let settle: Pending;
  const ready = new Promise<'leader' | 'follower'>((resolve, reject) => {
    settle = { resolve: resolve as Pending['resolve'], reject };
  });

  const answer = async (id: number, method: keyof HostApi) => {
    try {
      port.postMessage({ type: 'hostResult', id, value: await host[method]() });
    } catch (error) {
      port.postMessage({ type: 'hostResult', id, error: toEngineError(error) });
    }
  };

  port.addEventListener('message', ({ data }) => {
    switch (data.type) {
      case 'ready':
        return settle.resolve(data.role);
      case 'unavailable':
        return settle.reject(new EngineUnavailable(data.reason));
      case 'result':
        pending.get(data.id)?.resolve(data.value);
        pending.delete(data.id);
        return;
      case 'failure':
        pending.get(data.id)?.reject(data.error);
        pending.delete(data.id);
        return;
      case 'host':
        return void answer(data.id, data.method);
      case 'event':
        return listeners.forEach((listener) => listener(data.event));
    }
  });
  port.postMessage({ type: 'init', apiUrl });

  return {
    ready,
    call(method, ...args) {
      const id = next++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve: resolve as Pending['resolve'], reject });
        port.postMessage({ type: 'call', id, method, args });
      });
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
