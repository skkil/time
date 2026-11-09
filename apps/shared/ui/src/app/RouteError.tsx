import type { ErrorComponentProps } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/query';

export function RouteError({ error }: ErrorComponentProps) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="grid max-w-md gap-3 text-center">
        <h1 className="text-lg font-semibold">This screen hit an error</h1>
        <p className="font-mono text-xs break-words text-muted-foreground">
          {errorMessage(error)}
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            Go back
          </Button>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    </div>
  );
}
