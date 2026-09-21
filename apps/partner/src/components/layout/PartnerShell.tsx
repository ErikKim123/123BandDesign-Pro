// 대시보드 셸 — 사이드바 + 본문 + 입점 승인상태 배너. 서버 layout 이 세션을 주입한다.
'use client';
import { useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { PartnerProvider, type PartnerSession } from '@/lib/partner/context';
import { ActiveLocaleProvider } from '@/lib/i18n/locale-context';
import { DICT } from '@/i18n/dict';
import { PartnerSidebar } from './PartnerSidebar';

export function PartnerShell({
  session,
  children,
}: {
  session: PartnerSession;
  children: React.ReactNode;
}) {
  const { partner, email } = session;
  const [locale, setLocale] = useState<Locale>('en'); // 전역 언어 (EN/KO) — 기본 영문(EN)
  const t = DICT[locale === 'en' ? 'en' : 'ko'];

  // 입점 상태 안내 (active 가 아니면 일부 기능이 노출되지 않을 수 있음)
  let banner: { tone: 'warn' | 'info'; text: string } | null = null;
  if (!partner) {
    banner = { tone: 'warn', text: t.banner.noPartner };
  } else if (partner.status === 'pending') {
    banner = { tone: 'info', text: t.banner.pending };
  } else if (partner.status === 'suspended') {
    banner = { tone: 'warn', text: t.banner.suspended };
  }

  return (
    <PartnerProvider value={session}>
      <ActiveLocaleProvider value={{ locale, setLocale }}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <PartnerSidebar email={email} />
        <main className="flex-1 overflow-x-auto p-4 md:p-8">
          {banner && (
            <div
              className={
                'mb-5 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ' +
                (banner.tone === 'warn'
                  ? 'border-danger/30 bg-danger/5 text-danger'
                  : 'border-live/30 bg-live/5 text-live')
              }
            >
              {banner.tone === 'warn' ? (
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              ) : (
                <Clock size={18} className="mt-0.5 shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
          )}
          {children}
        </main>
      </div>
      </ActiveLocaleProvider>
    </PartnerProvider>
  );
}
