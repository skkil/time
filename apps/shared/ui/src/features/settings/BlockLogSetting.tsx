import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { commands } from '@/backend';
import { Checkbox } from '@/components/ui/checkbox';
import { keys } from '@/lib/query';

import { SettingRow } from './SettingRow';

export function BlockLogSetting() {
  const client = useQueryClient();
  const { data: enabled } = useQuery({
    queryKey: keys.autoLogBlocks,
    queryFn: commands.getAutoLogBlocks,
  });
  const toggle = useMutation({
    mutationFn: (next: boolean) => commands.setAutoLogBlocks(next),
    onSuccess: (_, next) => client.setQueryData(keys.autoLogBlocks, next),
  });
  const label = 'Log focus blocks as tracked time';

  return (
    <SettingRow
      label={label}
      description="When a focus block ends and no time was tracked on its task, it becomes tracked time, marked as logged from your plan. Remove any that didn’t happen."
    >
      <Checkbox
        aria-label={label}
        checked={enabled ?? true}
        disabled={toggle.isPending}
        onCheckedChange={(next) => toggle.mutate(next === true)}
      />
    </SettingRow>
  );
}
