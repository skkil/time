import { toEngineError } from '~/engine/errors';
import {
  type EngineEvent,
  type Method,
  RETRYABLE,
  type Relay,
} from '~/engine/protocol';

export type RelayChannel = {
  postMessage(message: Relay): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<Relay>) => void,
  ): void;
};

/** Serves a call for the worker `source`. */
export type Handler = (
  method: Method,
  args: unknown[],
  source: string,
) => Promise<unknown>;

type Outgoing = {
  method: Method;
  args: unknown[];
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  sentTo: string | null;
};

type RelayHooks = {
  onEvent(event: EngineEvent): void;
  onUnavailable(reason: string): void;
};

const LOST = {
  kind: 'database',
  message: 'The tab that saves your changes closed. Try again.',
};

/**
 * One worker's link to the workers of the other tabs. A follower sends its calls to whichever worker
 * leads; the leader serves them and broadcasts events. When the leader changes mid-call, reads are sent
 * again and writes fail rather than risk running twice.
 */
export class RelayLink {
  private leader: string | null = null;
  private serving: Handler | null = null;
  private readonly outgoing = new Map<number, Outgoing>();
  private next = 0;
  private foundLeader!: () => void;
  /** Resolves once some worker is known to lead. */
  readonly found = new Promise<void>((resolve) => {
    this.foundLeader = resolve;
  });

  constructor(
    private readonly channel: RelayChannel,
    readonly id: string,
    private readonly hooks: RelayHooks,
  ) {
    channel.addEventListener('message', ({ data }) => this.receive(data));
  }

  /** Asks whether some worker leads already. */
  start() {
    this.channel.postMessage({ type: 'ping' });
  }

  request(method: Method, args: unknown[]): Promise<unknown> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.outgoing.set(id, {
        method,
        args,
        resolve,
        reject,
        sentTo: this.leader,
      });
      this.send(id, method, args);
    });
  }

  /** This worker now owns the database: it serves every tab, its own unanswered calls included. */
  serve(handler: Handler) {
    this.serving = handler;
    this.channel.postMessage({ type: 'leader', id: this.id });
    this.takeOver(this.id);
  }

  broadcast(event: EngineEvent) {
    this.channel.postMessage({ type: 'event', event });
  }

  announceUnavailable(reason: string) {
    this.channel.postMessage({ type: 'unavailable', reason });
  }

  private send(id: number, method: Method, args: unknown[]) {
    if (this.serving)
      return void this.settle(id, this.serving(method, args, this.id));
    this.channel.postMessage({
      type: 'request',
      from: this.id,
      id,
      method,
      args,
    });
  }

  private settle(id: number, result: Promise<unknown>) {
    result.then(
      (value) => this.finish(id, { value }),
      (error: unknown) => this.finish(id, { error: toEngineError(error) }),
    );
  }

  private finish(id: number, outcome: { value?: unknown; error?: unknown }) {
    const call = this.outgoing.get(id);
    if (!call) return;
    this.outgoing.delete(id);
    if ('error' in outcome && outcome.error !== undefined)
      call.reject(outcome.error);
    else call.resolve(outcome.value);
  }

  private takeOver(leader: string) {
    const previous = this.leader;
    this.leader = leader;
    this.foundLeader();
    if (previous === leader) return;
    for (const [id, call] of this.outgoing) {
      if (previous === null && leader !== this.id) {
        call.sentTo ??= leader;
        continue;
      }
      if (call.sentTo !== null && !RETRYABLE.has(call.method)) {
        this.outgoing.delete(id);
        call.reject(LOST);
        continue;
      }
      call.sentTo = leader;
      this.send(id, call.method, call.args);
    }
  }

  private receive(message: Relay) {
    switch (message.type) {
      case 'ping':
        if (this.serving)
          this.channel.postMessage({ type: 'leader', id: this.id });
        return;
      case 'leader':
        return this.takeOver(message.id);
      case 'unavailable':
        return this.hooks.onUnavailable(message.reason);
      case 'request':
        return this.answer(message);
      case 'response':
        if (message.to === this.id) this.finish(message.id, message);
        return;
      case 'event':
        return this.hooks.onEvent(message.event);
    }
  }

  private answer(message: Extract<Relay, { type: 'request' }>) {
    const serving = this.serving;
    if (!serving) return;
    const reply = (outcome: { value?: unknown; error?: unknown }) =>
      this.channel.postMessage({
        type: 'response',
        to: message.from,
        id: message.id,
        ...outcome,
      } as Relay);
    serving(message.method, message.args, message.from).then(
      (value) => reply({ value }),
      (error: unknown) => reply({ error: toEngineError(error) }),
    );
  }
}
