import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { commands } from '@/bindings';
import { Checkbox } from '@/components/ui/checkbox';
import { keys } from '@/lib/query';
import { formatShortcut } from '@/lib/shortcuts';

import { SettingRow } from './SettingRow';

export function CaptureSettings() {
  const client = useQueryClient();
  const { data: enabled } = useQuery({
    queryKey: keys.captureHotkey,
    queryFn: commands.getCaptureHotkey,
  });
  const toggle = useMutation({
    mutationFn: (next: boolean) => commands.setCaptureHotkey(next),
    onSuccess: (_result, next) => client.setQueryData(keys.captureHotkey, next),
  });

  return (
    <div>
      <SettingRow
        label={`Capture from anywhere · ${formatShortcut('Mod+Alt+N')}`}
        description="Opens Quick Add over whatever you're doing, even when skkil time is in the background."
      >
        <Checkbox
          aria-label="Capture from anywhere"
          checked={enabled ?? true}
          onCheckedChange={(next) => toggle.mutate(next === true)}
        />
      </SettingRow>
      <SettingRow
        label="From your own shortcut"
        description="Wayland desktops don't let apps listen for keys in the background. Bind this command to a key in your desktop's settings instead."
      >
        <code className="rounded-md bg-white/[.06] px-2 py-1 text-xs">
          skkil-time --quick-add
        </code>
      </SettingRow>
    </div>
  );
}
