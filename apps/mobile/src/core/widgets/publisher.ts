import type { Glance } from '@skkil-time/client/types';

import {
  type WidgetSnapshot,
  nextRefresh,
  signedOutSnapshot,
  widgetSnapshot,
} from '@/core/widgets/snapshot';

export const PUBLISH_DELAY_MS = 1_000;
const MAX_TIMER_MS = 2_147_483_647;

export type WidgetPublisherOptions = {
  readGlance: () => Promise<Glance>;
  write: (json: string) => Promise<void>;
  now: () => number;
  delayMs?: number;
};

export interface WidgetPublisher {
  signedIn(signedIn: boolean): void;
  soon(): void;
  flush(): Promise<void>;
}

export function createWidgetPublisher({
  readGlance,
  write,
  now,
  delayMs = PUBLISH_DELAY_MS,
}: WidgetPublisherOptions): WidgetPublisher {
  let account: boolean | null = null;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let refresh: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();

  const send = (snapshot: WidgetSnapshot) => write(JSON.stringify(snapshot));

  const refreshAt = (at: number) => {
    clearTimeout(refresh);
    const wait = Math.min(MAX_TIMER_MS, Math.max(0, (at - now()) * 1000));
    refresh = setTimeout(() => publisher.soon(), wait);
  };

  async function publish() {
    if (account === null) return;
    if (!account) return send(signedOutSnapshot(now()));
    const glance = await readGlance();
    const at = now();
    if (!account) return;
    await send(widgetSnapshot(glance, at));
    refreshAt(nextRefresh(glance, at));
  }

  const run = () => {
    clearTimeout(pending);
    pending = undefined;
    queue = queue.then(publish).catch(() => undefined);
    return queue;
  };

  const publisher: WidgetPublisher = {
    signedIn(signedIn) {
      if (account === signedIn) return;
      account = signedIn;
      clearTimeout(refresh);
      void run();
    },
    soon() {
      if (!account) return;
      clearTimeout(pending);
      pending = setTimeout(run, delayMs);
    },
    flush: run,
  };
  return publisher;
}
