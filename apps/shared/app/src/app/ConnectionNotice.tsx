import { CloudOffIcon, LogInIcon, WifiOffIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { type ConnectionStatus, platform } from '@/platform';

const MESSAGES: Record<
  Exclude<ConnectionStatus, 'online'>,
  { icon: typeof WifiOffIcon; text: string }
> = {
  offline: {
    icon: WifiOffIcon,
    text: 'You’re offline. Changes won’t save until you’re back.',
  },
  unreachable: {
    icon: CloudOffIcon,
    text: 'Can’t reach skkil time. Trying again…',
  },
  signedOut: {
    icon: LogInIcon,
    text: 'Your session ended. Sign in again to keep saving.',
  },
};

/** A quiet notice while the app can't save: offline, server down or signed out. */
export function ConnectionNotice() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  useEffect(() => platform().onConnectionChange?.(setStatus), []);
  if (status === 'online') return null;
  const { icon: Icon, text } = MESSAGES[status];
  const account = platform().account;

  return (
    <div
      role="status"
      className="pointer-events-auto fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-black/55 px-4 py-2.5 text-sm text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md"
    >
      <Icon className="size-4 shrink-0 opacity-80" strokeWidth={1.5} />
      <span className="flex-1">{text}</span>
      {status === 'signedOut' && account && (
        <Button size="sm" variant="secondary" onClick={account.signInAgain}>
          Sign in
        </Button>
      )}
    </div>
  );
}
