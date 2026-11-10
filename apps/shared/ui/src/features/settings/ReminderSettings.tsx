import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type NotificationPrefs, commands } from '@/backend';
import { Checkbox } from '@/components/ui/checkbox';
import { keys } from '@/lib/query';
import { platform } from '@/platform';

import { SettingRow } from './SettingRow';

const deviceKey = [...keys.reminders, 'device'] as const;
const prefsKey = [...keys.reminders, 'kinds'] as const;
const EVENT_LEAD_MINUTES = 10;

export function ReminderSettings() {
  const client = useQueryClient();
  const notifications = platform().notifications;
  const { data: enabled } = useQuery({
    queryKey: keys.reminders,
    queryFn: commands.getRemindersEnabled,
  });
  const { data: deviceEnabled } = useQuery({
    queryKey: deviceKey,
    queryFn: () => notifications?.isEnabled() ?? true,
  });
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (next && notifications && !(await notifications.enable()))
        return false;
      if (!next) await notifications?.disable();
      await commands.setRemindersEnabled(next);
      return true;
    },
    onSuccess: (applied, next) => {
      if (!applied) return;
      client.setQueryData(keys.reminders, next);
      client.setQueryData(deviceKey, next);
    },
  });
  const label = notifications ? 'Reminders' : 'Desktop reminders';

  return (
    <div>
      <SettingRow
        label={label}
        description={
          notifications
            ? 'Sends a notification to this device when a task reaches its time. Tapping it opens the task.'
            : 'Shows a notification when a task reaches its time. Clicking it opens the task.'
        }
      >
        <Checkbox
          aria-label={label}
          checked={(enabled ?? true) && (deviceEnabled ?? !notifications)}
          disabled={toggle.isPending}
          onCheckedChange={(next) => toggle.mutate(next === true)}
        />
      </SettingRow>
      {toggle.data === false && (
        <p className="py-2 text-xs text-destructive">
          Notifications are blocked. Allow them for this site in your browser
          settings, then turn reminders on again.
        </p>
      )}
      {toggle.isError && (
        <p className="py-2 text-xs text-destructive">
          Couldn’t change reminders. Try again.
        </p>
      )}
      <ReminderKinds disabled={enabled === false} />
    </div>
  );
}

const KINDS = [
  {
    key: 'tasks',
    label: 'Tasks with a time',
    description: 'When a task reaches its time.',
  },
  {
    key: 'blocks',
    label: 'Focus blocks',
    description: 'When a planned focus block starts.',
  },
  {
    key: 'events',
    label: 'Events',
    description: `${EVENT_LEAD_MINUTES} minutes before an event starts.`,
  },
] as const;

function ReminderKinds({ disabled }: { disabled: boolean }) {
  const client = useQueryClient();
  const { data: prefs } = useQuery({
    queryKey: prefsKey,
    queryFn: commands.getNotificationPrefs,
  });
  const save = useMutation({
    mutationFn: (next: NotificationPrefs) =>
      commands.setNotificationPrefs(next),
    onSuccess: (_, next) => client.setQueryData(prefsKey, next),
  });
  if (!prefs) return null;

  return KINDS.map((kind) => (
    <SettingRow
      key={kind.key}
      label={kind.label}
      description={kind.description}
    >
      <Checkbox
        aria-label={kind.label}
        checked={prefs[kind.key]}
        disabled={disabled || save.isPending}
        onCheckedChange={(next) =>
          save.mutate({ ...prefs, [kind.key]: next === true })
        }
      />
    </SettingRow>
  ));
}
