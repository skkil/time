import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { commands } from '@/backend';
import { Checkbox } from '@/components/ui/checkbox';
import { keys } from '@/lib/query';

import { SettingRow } from './SettingRow';

export function ReminderSettings() {
  const client = useQueryClient();
  const { data: enabled } = useQuery({
    queryKey: keys.reminders,
    queryFn: commands.getRemindersEnabled,
  });
  const toggle = useMutation({
    mutationFn: (next: boolean) => commands.setRemindersEnabled(next),
    onSuccess: (_result, next) => client.setQueryData(keys.reminders, next),
  });

  return (
    <div>
      <SettingRow
        label="Desktop reminders"
        description="Shows a notification when a task reaches its time. Clicking it opens the task."
      >
        <Checkbox
          aria-label="Desktop reminders"
          checked={enabled ?? true}
          onCheckedChange={(next) => toggle.mutate(next === true)}
        />
      </SettingRow>
    </div>
  );
}
