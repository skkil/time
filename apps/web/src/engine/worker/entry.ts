import { webLock } from '@skkil/store-client';
import type { FromWorker, Relay, ToWorker } from '~/engine/protocol';
import { openEngine, probeStorage } from '~/engine/worker/open';
import { createRouter } from '~/engine/worker/router';

const LOCK = 'skkil-time-engine';
const CHANNEL = 'skkil-time-engine';

type WorkerScope = {
  postMessage(message: FromWorker): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ToWorker>) => void,
  ): void;
};

const scope = self as unknown as WorkerScope;
const channel = new BroadcastChannel(CHANNEL) as BroadcastChannel & {
  postMessage(message: Relay): void;
};

const route = createRouter({
  id: crypto.randomUUID(),
  page: scope,
  channel,
  lock: webLock(LOCK, navigator.locks),
  probe: probeStorage,
  open: openEngine,
});

scope.addEventListener('message', ({ data }) => route(data));
