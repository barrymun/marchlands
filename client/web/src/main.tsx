import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from '@/app';
import { LocaleRoot } from '@/components/locale-root/locale-root';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { i18nReady } from '@/lib/i18n';

import '@/index.css';

import { Theme } from '@/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

// the chosen locale's text first (a locale other than English is a separate file)
await i18nReady;

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme={Theme.SYSTEM} enableSystem disableTransitionOnChange storageKey="marchlands-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TooltipProvider delayDuration={200}>
            <LocaleRoot>
              <App />
            </LocaleRoot>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
