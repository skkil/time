import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { commands } from '@/backend';
import { Checkbox } from '@/components/ui/checkbox';
import { keys } from '@/lib/query';
import { platform } from '@/platform';

import { SettingRow } from './SettingRow';

const deviceKey = [...keys.reminders, 'device'] as const;

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
    </div>
  );
}
