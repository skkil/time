import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Checkbox } from '@/components/ui/checkbox';
import { type Tray } from '@/platform';

import { SettingRow } from './SettingRow';

const trayKey = ['tray', 'keep-on-close'] as const;

export function TraySetting({ tray }: { tray: Tray }) {
  const client = useQueryClient();
  const { data: keep } = useQuery({
    queryKey: trayKey,
    queryFn: () => tray.keepOnClose(),
  });
  const toggle = useMutation({
    mutationFn: (next: boolean) => tray.setKeepOnClose(next),
    onSuccess: (_, next) => client.setQueryData(trayKey, next),
  });
  const label = 'Keep running in the tray';

  return (
    <SettingRow
      label={label}
      description="Closing the window keeps skkil time in the tray or menu bar, with what’s now and next, today’s musts and Quick Add. Quit from the tray menu. Some Linux desktops show no tray; leave this off there."
    >
      <Checkbox
        aria-label={label}
        checked={keep ?? false}
        disabled={toggle.isPending}
        onCheckedChange={(next) => toggle.mutate(next === true)}
      />
    </SettingRow>
  );
}
