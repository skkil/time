import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Relay } from '~/engine/protocol';
import { type Handler, RelayLink } from '~/engine/worker/relay';

const channels: BroadcastChannel[] = [];

function channel(name: string) {
  const opened = new BroadcastChannel(name);
  channels.push(opened);
  return opened as BroadcastChannel & { postMessage(message: Relay): void };
}

afterEach(() => channels.splice(0).forEach((opened) => opened.close()));

const hooks = () => ({ onEvent: vi.fn(), onUnavailable: vi.fn() });

describe('RelayLink', () => {
  it('sends a follower’s calls to the leader and its events back', async () => {
    const name = `relay-${Math.random()}`;
    const served = vi.fn<Handler>(async (method, args) => ({ method, args }));
    const leader = new RelayLink(channel(name), 'leader', hooks());
    leader.serve(served);
    const followerHooks = hooks();
    const follower = new RelayLink(channel(name), 'follower', followerHooks);
    follower.start();
    await follower.found;

    await expect(follower.request('query', ['listTasks', {}])).resolves.toEqual(
      { method: 'query', args: ['listTasks', {}] },
    );
    expect(served).toHaveBeenCalledWith('query', ['listTasks', {}], 'follower');

    leader.broadcast({ kind: 'changed', tables: ['task'], source: null });
    await vi.waitFor(() =>
      expect(followerHooks.onEvent).toHaveBeenCalledWith({
        kind: 'changed',
        tables: ['task'],
        source: null,
      }),
    );
  });

  it('passes failures on as { kind, message }', async () => {
    const name = `relay-${Math.random()}`;
    const leader = new RelayLink(channel(name), 'leader', hooks());
    leader.serve(async () => {
      throw { kind: 'invalid', message: 'Title is required.' };
    });
    const follower = new RelayLink(channel(name), 'follower', hooks());
    follower.start();
    await follower.found;
    await expect(
      follower.request('mutate', ['createTask', {}]),
    ).rejects.toEqual({ kind: 'invalid', message: 'Title is required.' });
  });

  it('serves its own calls once it leads', async () => {
    const link = new RelayLink(
      channel(`relay-${Math.random()}`),
      'solo',
      hooks(),
    );
    link.serve(async (method) => method);
    await expect(link.request('status', [])).resolves.toBe('status');
  });

  it('when the leader changes mid-call, reads go again and writes fail', async () => {
    const name = `relay-${Math.random()}`;
    const silent = new RelayLink(channel(name), 'old', hooks());
    silent.serve(() => new Promise(() => undefined));
    const follower = new RelayLink(channel(name), 'follower', hooks());
    follower.start();
    await follower.found;

    const read = follower.request('query', ['listTasks', {}]);
    const write = follower.request('mutate', ['createTask', {}]);
    const next = new RelayLink(channel(name), 'new', hooks());
    next.serve(async (method) => `served ${method}`);

    await Promise.all([
      expect(read).resolves.toBe('served query'),
      expect(write).rejects.toMatchObject({ kind: 'database' }),
    ]);
  });

  it('reports a leader that couldn’t open the database', async () => {
    const name = `relay-${Math.random()}`;
    const followerHooks = hooks();
    new RelayLink(channel(name), 'follower', followerHooks);
    new RelayLink(channel(name), 'leader', hooks()).announceUnavailable(
      'No OPFS',
    );
    await vi.waitFor(() =>
      expect(followerHooks.onUnavailable).toHaveBeenCalledWith('No OPFS'),
    );
  });
});
