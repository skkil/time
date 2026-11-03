import type { LeaderLock } from '@skkil/store-client';
import { toEngineError } from '~/engine/errors';
import type {
  EngineEvent,
  FromWorker,
  HostApi,
  Method,
  ToWorker,
} from '~/engine/protocol';
import {
  type Handler,
  type RelayChannel,
  RelayLink,
} from '~/engine/worker/relay';

export type OpenOptions = {
  apiUrl: string;
  host: HostApi;
  emit(event: EngineEvent): void;
};

export type RouterOptions = {
  /** This worker's id among the tabs' workers. */
  id: string;
  page: { postMessage(message: FromWorker): void };
  channel: RelayChannel;
  /** Held by the one worker per origin that owns the database. */
  lock: LeaderLock;
  /** Why the database can't be kept in this browser, or null when it can. */
  probe(): Promise<string | null>;
  /** Opens the database and starts serving it; only the lock holder calls it. */
  open(options: OpenOptions): Promise<Handler>;
};

/**
 * The worker of one tab: it competes for the database lock, owns the database once it wins, and until
 * then sends the page's calls to the worker that does.
 */
export function createRouter({
  id,
  page,
  channel,
  lock,
  probe,
  open,
}: RouterOptions) {
  let leading = false;
  let settled = false;
  let started: Promise<RelayLink> | null = null;
  const asked = new Map<
    number,
    { resolve(value: unknown): void; reject(error: unknown): void }
  >();
  let nextAsk = 0;

  const settle = (message: FromWorker) => {
    if (settled) return;
    settled = true;
    page.postMessage(message);
  };
  const unavailable = (reason: string) =>
    settle({ type: 'unavailable', reason });
  const toPage = (event: EngineEvent) => {
    if (event.kind === 'changed' && event.source === id) return;
    page.postMessage({ type: 'event', event });
  };

  const host: HostApi = {
    accessToken: () =>
      new Promise((resolve, reject) => {
        const ask = nextAsk++;
        asked.set(ask, {
          resolve: resolve as (value: unknown) => void,
          reject,
        });
        page.postMessage({ type: 'host', id: ask, method: 'accessToken' });
      }),
  };

  const lead = async (relay: RelayLink, apiUrl: string, stop: () => void) => {
    leading = true;
    const opening = open({
      apiUrl,
      host,
      emit: (event) => {
        toPage(event);
        relay.broadcast(event);
      },
    });
    relay.serve(async (method, args, source) =>
      (await opening)(method, args, source),
    );
    try {
      await opening;
      settle({ type: 'ready', role: 'leader' });
    } catch (error) {
      const { message } = toEngineError(error);
      relay.announceUnavailable(message);
      unavailable(message);
      stop();
    }
  };

  const start = async (apiUrl: string) => {
    const reason = await probe();
    if (reason) {
      unavailable(reason);
      throw new Error(reason);
    }
    const relay = new RelayLink(channel, id, {
      onEvent: toPage,
      onUnavailable: unavailable,
    });
    void relay.found.then(() => {
      if (!leading) settle({ type: 'ready', role: 'follower' });
    });
    relay.start();
    const controller = new AbortController();
    lock.acquire(controller.signal).then(
      () => lead(relay, apiUrl, () => controller.abort()),
      () => undefined,
    );
    return relay;
  };

  const call = async (callId: number, method: Method, args: unknown[]) => {
    try {
      if (!started) throw new Error('The engine worker was not started.');
      const relay = await started;
      page.postMessage({
        type: 'result',
        id: callId,
        value: await relay.request(method, args),
      });
    } catch (error) {
      page.postMessage({
        type: 'failure',
        id: callId,
        error: toEngineError(error),
      });
    }
  };

  return (message: ToWorker) => {
    switch (message.type) {
      case 'init':
        started ??= start(message.apiUrl);
        started.catch(() => undefined);
        return;
      case 'call':
        return void call(message.id, message.method, message.args);
      case 'hostResult': {
        const pending = asked.get(message.id);
        asked.delete(message.id);
        if (message.error) pending?.reject(message.error);
        else pending?.resolve(message.value);
        return;
      }
    }
  };
}
