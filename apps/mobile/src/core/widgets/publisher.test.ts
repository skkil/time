import type { Glance } from '@skkil-time/client/types';
import { toSeconds } from '@skkil-time/rules/time';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createWidgetPublisher } from '@/core/widgets/publisher';
import type { WidgetSnapshot } from '@/core/widgets/snapshot';

const NOON = toSeconds(new Date(2026, 10, 10, 12));

const GLANCE: Glance = {
  timer: null,
  now: null,
  next: {
    kind: 'block',
    title: 'Read',
    taskId: 'read',
    startsAt: NOON + 1800,
    endsAt: NOON + 3600,
  },
  musts: [{ id: 'a', title: 'Call the bank' }],
  earlierCount: 0,
};

function setup() {
  let clock = NOON;
  const readGlance = vi.fn(async () => GLANCE);
  const written: WidgetSnapshot[] = [];
  const write = vi.fn(async (json: string) => {
    written.push(JSON.parse(json) as WidgetSnapshot);
  });
  const publisher = createWidgetPublisher({
    readGlance,
    write,
    now: () => clock,
    delayMs: 1000,
  });
  const advance = async (ms: number) => {
    clock += ms / 1000;
    await vi.advanceTimersByTimeAsync(ms);
  };
  return { publisher, readGlance, write, written, advance };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the widget publisher', () => {
  it('waits until it knows whether the phone is signed in', async () => {
    const { publisher, write, advance } = setup();
    publisher.soon();
    await advance(5000);
    expect(write).not.toHaveBeenCalled();
  });

  it('publishes right away on sign-in, then once per burst of writes', async () => {
    const { publisher, readGlance, written, advance } = setup();
    publisher.signedIn(true);
    await advance(0);
    expect(written).toHaveLength(1);
    expect(written[0].entries[0].next?.title).toBe('Read');

    publisher.soon();
    await advance(500);
    publisher.soon();
    await advance(500);
    publisher.soon();
    expect(readGlance).toHaveBeenCalledTimes(1);
    await advance(1000);
    expect(readGlance).toHaveBeenCalledTimes(2);
    expect(written).toHaveLength(2);
  });

  it('reads again when the next item starts, while the app is open', async () => {
    const { publisher, readGlance, advance } = setup();
    publisher.signedIn(true);
    await advance(0);
    await advance(1800 * 1000 - 1);
    expect(readGlance).toHaveBeenCalledTimes(1);
    await advance(1 + 1000);
    expect(readGlance).toHaveBeenCalledTimes(2);
  });

  it('writes the signed-out picture and ignores writes after sign-out', async () => {
    const { publisher, readGlance, written, advance } = setup();
    publisher.signedIn(true);
    await advance(0);
    publisher.signedIn(false);
    await advance(0);
    expect(written.at(-1)?.entries[0].now.title).toBe('Sign in to see today');
    publisher.soon();
    await advance(60 * 60 * 1000);
    expect(readGlance).toHaveBeenCalledTimes(1);
    expect(written).toHaveLength(2);
  });

  it('flushes a pending publish at once', async () => {
    const { publisher, written, advance } = setup();
    publisher.signedIn(true);
    await advance(0);
    publisher.soon();
    await publisher.flush();
    expect(written).toHaveLength(2);
    await advance(2000);
    expect(written).toHaveLength(2);
  });

  it('keeps going after a failed read', async () => {
    const { publisher, readGlance, written, advance } = setup();
    readGlance.mockRejectedValueOnce(new Error('replica closed'));
    publisher.signedIn(true);
    await advance(0);
    expect(written).toHaveLength(0);
    publisher.soon();
    await advance(1000);
    expect(written).toHaveLength(1);
  });
});
