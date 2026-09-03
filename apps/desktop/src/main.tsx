import '@fontsource-variable/hanken-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import 'pretendard/dist/web/static/Pretendard-Medium.css';
import 'pretendard/dist/web/static/Pretendard-Regular.css';
import 'pretendard/dist/web/static/Pretendard-SemiBold.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { router } from '@/app/router';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { syncColorScheme } from '@/hooks/use-color-scheme';
import { queryClient } from '@/lib/query';
import { syncZoom } from '@/lib/zoom';

import './styles/globals.css';

syncColorScheme();
syncZoom();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={400}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
