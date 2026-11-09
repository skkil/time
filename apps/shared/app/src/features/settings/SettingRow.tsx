import type { ReactNode } from 'react';

import { platform } from '@/platform';

export function SettingRow({
  label,
  description,
  device = false,
  hint,
  children,
}: {
  label: string;
  description?: string;
  /** Extra detail shown as a tooltip on the label. */
  hint?: string;
  /** Kept on this device even when other settings follow the account. */
  device?: boolean;
  children: ReactNode;
}) {
  const shared = platform().preferences !== undefined;
  return (
    <div className="flex flex-col items-start gap-3 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="grid gap-0.5" title={hint}>
        <span className="flex items-center gap-2 text-sm font-medium">
          {label}
          {device && shared && (
            <span className="rounded-full border px-1.5 py-px text-[10px] font-normal text-muted-foreground">
              This device
            </span>
          )}
        </span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
