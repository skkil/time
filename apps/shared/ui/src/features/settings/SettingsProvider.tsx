import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { SettingsDialog } from './SettingsDialog';
import { SettingsContext } from './settings-context';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string>();
  const openSettings = useCallback((next?: string) => {
    setSection(next);
    setOpen(true);
  }, []);
  const api = useMemo(() => ({ openSettings }), [openSettings]);

  return (
    <SettingsContext value={api}>
      {children}
      <SettingsDialog open={open} onOpenChange={setOpen} section={section} />
    </SettingsContext>
  );
}
