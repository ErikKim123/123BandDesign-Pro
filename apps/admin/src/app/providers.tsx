// Design Ref: §2.3 — react-query Provider (서버상태 캐싱) + 로케일 Provider
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { LocaleProvider } from '@/lib/locale/LocaleContext';
import type { AdminLocale } from '@/i18n/dict';

export function Providers({
  children,
  locale,
}: {
  children: ReactNode;
  locale: AdminLocale;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initial={locale}>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}
