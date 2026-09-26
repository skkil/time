import '@fontsource-variable/hanken-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import 'pretendard/dist/web/static/Pretendard-Medium.css';
import 'pretendard/dist/web/static/Pretendard-Regular.css';
import 'pretendard/dist/web/static/Pretendard-SemiBold.css';
import { type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { router } from '@/app/router';
import { type Backend, installBackend } from '@/backend';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { syncColorScheme } from '@/hooks/use-color-scheme';
import { syncExternalChanges } from '@/lib/external-changes';
import { syncIdle } from '@/lib/idle';
import { syncPriorityColors } from '@/lib/priority-colors';
import { queryClient } from '@/lib/query';
import { syncZoom } from '@/lib/zoom';
import { type Platform, installPlatform } from '@/platform';
import '@/styles/globals.css';

type MountOptions = {
  backend: Backend;
  platform: Platform;
  wrap?: (app: ReactNode) => ReactNode;
};

export function mount({
  backend,
  platform,
  wrap = (app) => app,
}: MountOptions) {
  installBackend(backend);
  installPlatform(platform);
  syncColorScheme();
  syncIdle();
  syncZoom();
  syncPriorityColors();
  syncExternalChanges();

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      {wrap(
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={400}>
            <RouterProvider router={router} />
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </QueryClientProvider>,
      )}
    </StrictMode>,
  );
}
