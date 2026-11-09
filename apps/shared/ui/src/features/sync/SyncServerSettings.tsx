import { useState } from 'react';

import { Disclosure } from '@/components/Disclosure';
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

/** Where this computer syncs, only for self-hosted servers, and the last error in full. */
export function SyncServerSettings({
  disabled,
  error,
}: {
  disabled: boolean;
  error: string | null;
}) {
  const { data: saved } = useSyncConfig();
  const save = useSaveSyncConfig();
  const [draft, setDraft] = useState<SyncConfig | null>(null);
  const config = draft ?? saved;
  if (!config) return null;

  return (
    <Disclosure summary="Server" className="py-3 text-sm">
      <div className="mt-3 grid gap-2">
        {error && (
          <p className="text-xs break-words text-muted-foreground">
            Last error: <code className="font-mono">{error}</code>
          </p>
        )}
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
    </Disclosure>
  );
}
