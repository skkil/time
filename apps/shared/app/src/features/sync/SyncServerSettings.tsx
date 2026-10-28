import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSaveSyncConfig, useSyncConfig } from '@/features/sync/api';
import type { SyncConfig } from '@/platform';

const FIELDS: { key: keyof SyncConfig; label: string }[] = [
  { key: 'serverUrl', label: 'Server' },
  { key: 'authority', label: 'Sign-in issuer' },
  { key: 'clientId', label: 'Client ID' },
  { key: 'audience', label: 'Audience' },
];

/** Where this computer syncs; only for self-hosted servers. */
export function SyncServerSettings({ disabled }: { disabled: boolean }) {
  const { data: saved } = useSyncConfig();
  const save = useSaveSyncConfig();
  const [draft, setDraft] = useState<SyncConfig | null>(null);
  const config = draft ?? saved;
  if (!config) return null;

  return (
    <details className="py-3 text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        Server
      </summary>
      <div className="mt-3 grid gap-2">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="grid gap-1 text-xs text-muted-foreground">
            {label}
            <Input
              value={config[key] ?? ''}
              disabled={disabled}
              onChange={(event) =>
                setDraft({ ...config, [key]: event.target.value })
              }
            />
          </label>
        ))}
        {disabled && (
          <p className="text-xs text-muted-foreground">
            Sign out to change the server.
          </p>
        )}
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || draft === null || save.isPending}
            onClick={() =>
              save.mutate(config, { onSuccess: () => setDraft(null) })
            }
          >
            Save
          </Button>
        </div>
      </div>
    </details>
  );
}
