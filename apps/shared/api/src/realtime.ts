import { type Api, unwrap } from '#index';

export type ChangeEvent = {
  type: 'changed';
  version: number;
  writer: string | null;
  topic: string;
};

export type RealtimeStatus = 'connecting' | 'open' | 'closed';

export type RealtimeOptions = {
  api: Api;
  baseUrl: string;
  clientId: string;
  /** Called for writes made by any other client of the same account. */
  onChange: (event: ChangeEvent) => void;
  /** Called after every reconnect, so callers can refetch what they may have missed. */
  onReconnect?: () => void;
  onStatus?: (status: RealtimeStatus) => void;
};

const MAX_DELAY_MS = 30_000;

const socketUrl = (baseUrl: string, ticket: string) =>
  `${baseUrl.replace(/^http/, 'ws')}/api/v1/realtime?ticket=${encodeURIComponent(ticket)}`;

/**
 * Keeps one websocket open to the server and reports other clients' writes. Reconnects with jittered
 * exponential backoff; call the returned `resume` when the app returns to the foreground or the network
 * comes back, and `close` to stop for good.
 */
export function connectRealtime({
  api,
  baseUrl,
  clientId,
  onChange,
  onReconnect,
  onStatus,
}: RealtimeOptions) {
  let socket: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let opened = false;

  const schedule = () => {
    if (closed || timer) return;
    const delay =
      Math.min(MAX_DELAY_MS, 1000 * 2 ** attempt) * (0.5 + Math.random() / 2);
    attempt += 1;
    timer = setTimeout(() => {
      timer = null;
      void open();
    }, delay);
  };

  const open = async () => {
    if (closed || socket) return;
    onStatus?.('connecting');
    let ticket: string;
    try {
      ticket = (await unwrap(api.POST('/api/v1/realtime/tickets'))).ticket;
    } catch {
      onStatus?.('closed');
      return schedule();
    }
    if (closed) return;
    const next = new WebSocket(socketUrl(baseUrl, ticket));
    socket = next;
    next.onopen = () => {
      if (opened) onReconnect?.();
      opened = true;
      attempt = 0;
      onStatus?.('open');
    };
    next.onmessage = (message) => {
      try {
        const event = JSON.parse(String(message.data)) as ChangeEvent;
        if (event.type === 'changed' && event.writer !== clientId)
          onChange(event);
      } catch {
        return;
      }
    };
    next.onclose = () => {
      if (socket === next) socket = null;
      onStatus?.('closed');
      schedule();
    };
    next.onerror = () => next.close();
  };

  void open();

  return {
    resume() {
      if (closed || socket) return;
      if (timer) clearTimeout(timer);
      timer = null;
      attempt = 0;
      void open();
    },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
      socket = null;
    },
  };
}
