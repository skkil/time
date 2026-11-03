import { afterEach, describe, expect, it, vi } from 'vitest';
import { EngineUnavailable, connectEngine } from '~/engine/client';
import type { FromWorker, Relay, ToWorker } from '~/engine/protocol';
import type { Handler } from '~/engine/worker/relay';
import { type RouterOptions, createRouter } from '~/engine/worker/router';

const opened: { close(): void }[] = [];
afterEach(() => opened.splice(0).forEach((port) => port.close()));

/** A page and its worker joined by a MessageChannel, the worker routed as in the browser. */
function connect(options: Partial<RouterOptions> = {}, token = 'access') {
  const { port1: page, port2: worker } = new MessageChannel();
  const channel = new BroadcastChannel(`engine-${Math.random()}`);
  opened.push(page, worker, channel);
  const route = createRouter({
    id: 'worker-1',
    page: { postMessage: (message: FromWorker) => worker.postMessage(message) },
    channel: channel as BroadcastChannel & {
      postMessage(message: Relay): void;
    },
    lock: { acquire: async () => undefined },
    probe: async () => null,
    open: async () => async (method, args) => ({ method, args }),
    ...options,
  });
  worker.addEventListener('message', (event) =>
    route((event as MessageEvent<ToWorker>).data),
  );
  worker.start();
  const client = connectEngine(
    page as never,
    { accessToken: async () => token },
    'http://api.test',
  );
  page.start();
  return client;
}

describe('the engine worker RPC', () => {
  it('becomes ready as the leader and answers calls by name', async () => {
    const client = connect();
    await expect(client.ready).resolves.toBe('leader');
    await expect(
      client.call('query', 'getTask', { id: 't1' }),
    ).resolves.toEqual({ method: 'query', args: ['getTask', { id: 't1' }] });
  });

  it('rejects with the engine’s { kind, message }', async () => {
    const client = connect({
      open: async () => async () => {
        throw { kind: 'notFound', message: 'Task' };
      },
    });
    await expect(client.call('query', 'getTask', { id: 'x' })).rejects.toEqual({
      kind: 'notFound',
      message: 'Task',
    });
  });

  it('answers the worker’s questions about the session', async () => {
    let token: string | null = null;
    const client = connect({
      open: async ({ host }) => {
        token = await host.accessToken();
        return async () => null;
      },
    });
    await client.ready;
    expect(token).toBe('access');
  });

  it('relays the worker’s events except changes the page made itself', async () => {
    let emit: Parameters<RouterOptions['open']>[0]['emit'] = () => undefined;
    const client = connect({
      open: async (options) => {
        emit = options.emit;
        return async () => null;
      },
    });
    const events = vi.fn();
    client.onEvent(events);
    await client.ready;
    emit({ kind: 'changed', tables: [], source: 'worker-1' });
    emit({ kind: 'changed', tables: ['task'], source: null });
    await vi.waitFor(() => expect(events).toHaveBeenCalledTimes(1));
    expect(events).toHaveBeenCalledWith({
      kind: 'changed',
      tables: ['task'],
      source: null,
    });
  });

  it('reports a browser without offline storage', async () => {
    const client = connect({ probe: async () => 'No OPFS here' });
    await expect(client.ready).rejects.toBeInstanceOf(EngineUnavailable);
  });

  it('reports a database that failed to open', async () => {
    const failing: RouterOptions['open'] = async () => {
      throw new Error('Couldn’t open browser storage');
    };
    const client = connect({ open: failing as () => Promise<Handler> });
    await expect(client.ready).rejects.toThrow('Couldn’t open browser storage');
  });
});
