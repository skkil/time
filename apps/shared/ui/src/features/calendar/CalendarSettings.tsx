import { formatDistanceToNowStrict } from 'date-fns';
import { useEffect, useState } from 'react';

import type { CalendarSource } from '@/backend';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SettingRow } from '@/features/settings/SettingRow';
import { fromSeconds } from '@/lib/time';
import type { CalendarAccount } from '@/platform';

import {
  useCalendarSources,
  useCalendarStatus,
  useConnectCalendar,
  useDisconnectCalendar,
  useSetCalendarSourceVisible,
} from './api';

const WAIT_MS = 3 * 60_000;

export function CalendarSettings() {
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const { data: status } = useCalendarStatus({
    waiting: waitingSince !== null,
  });
  const { data: sources = [] } = useCalendarSources();
  const connect = useConnectCalendar();
  const accounts = status?.accounts ?? [];
  const settled =
    waitingSince !== null &&
    accounts.some(
      (account) =>
        account.status === 'active' &&
        (account.syncedAt ?? 0) * 1000 >= waitingSince,
    );

  useEffect(() => {
    if (waitingSince === null) return;
    const stop = window.setTimeout(() => setWaitingSince(null), WAIT_MS);
    return () => window.clearTimeout(stop);
  }, [waitingSince]);

  if (!status) return null;
  if (settled) setWaitingSince(null);

  const start = () => {
    setWaitingSince(Date.now() - 5_000);
    connect.mutate();
  };

  if (!status.signedIn)
    return (
      <SettingRow
        label="Google Calendar"
        description="Calendars belong to your account. Sign in under Sync to see your events on this device."
      >
        <span />
      </SettingRow>
    );

  if (!status.available)
    return (
      <SettingRow
        label="Google Calendar"
        description="Calendars aren’t set up on this server yet, so there’s nothing to connect."
      >
        <span />
      </SettingRow>
    );

  return (
    <div>
      {accounts.length === 0 && (
        <SettingRow
          label="Google Calendar"
          description="Show your meetings beside your plan on Day and Week. skkil time only reads your calendar and never changes it."
        >
          <Button size="sm" disabled={connect.isPending} onClick={start}>
            {waitingSince === null
              ? 'Connect Google Calendar'
              : 'Waiting for Google…'}
          </Button>
        </SettingRow>
      )}
      {accounts.map((account) => (
        <AccountRows
          key={account.id}
          account={account}
          sources={sources.filter((source) => source.accountId === account.id)}
          waiting={waitingSince !== null}
          onReconnect={start}
        />
      ))}
    </div>
  );
}

function AccountRows({
  account,
  sources,
  waiting,
  onReconnect,
}: {
  account: CalendarAccount;
  sources: CalendarSource[];
  waiting: boolean;
  onReconnect: () => void;
}) {
  const disconnect = useDisconnectCalendar();
  const toggle = useSetCalendarSourceVisible();
  const lost = account.status === 'reauth';
  const label = account.email ?? 'Google account';

  return (
    <div className="border-b last:border-b-0">
      {lost && (
        <div
          role="status"
          className="mt-3 flex flex-col items-start gap-3 rounded-md border border-amber-300/40 bg-amber-200/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-foreground/90">
            Google stopped sharing {label}’s calendar with skkil time. Connect
            again to keep its events up to date.
          </p>
          <Button size="sm" disabled={waiting} onClick={onReconnect}>
            {waiting ? 'Waiting for Google…' : 'Connect again'}
          </Button>
        </div>
      )}
      <SettingRow
        label={label}
        description={
          lost
            ? 'Showing the events read before access stopped.'
            : account.syncedAt
              ? `Google Calendar · read ${formatDistanceToNowStrict(fromSeconds(account.syncedAt), { addSuffix: true })}`
              : 'Google Calendar · reading your calendars…'
        }
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={disconnect.isPending}>
              Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect {label}?</AlertDialogTitle>
              <AlertDialogDescription>
                Its events leave Day and Week on every device, and skkil time
                gives up its access to the calendar. You can connect again any
                time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={() => disconnect.mutate(account.id)}>
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingRow>
      {sources.length > 0 && (
        <ul className="grid gap-0.5 pb-3 pl-1">
          {sources.map((source) => (
            <li key={source.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white/[.04]">
                <Checkbox
                  checked={source.visible}
                  onCheckedChange={(next) =>
                    toggle.mutate({ id: source.id, visible: next === true })
                  }
                />
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: source.color }}
                />
                <span className="min-w-0 truncate">{source.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
