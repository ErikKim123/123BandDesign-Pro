// Design Ref: §5.3 / 백오피스 — 반응형 사이드바 (PC: 고정, 모바일: 드로어). admin 패턴 동일.
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, TicketCheck, ShoppingCart, Receipt, Building2, QrCode, Star, MessageSquare, ClipboardList, Menu, X, LogOut,
  type LucideIcon,
} from 'lucide-react';
import type { Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import { useLocaleControl } from '@/lib/i18n/locale-context';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';

// 오거나이저 본인 데이터에 한정된 메뉴 (RLS 가 본인 행만 노출). 라벨은 t.nav 로 번역.
// 인스타그램 게시/예약은 어드민(관리자)으로 일원화 — 오거나이저 메뉴에서 제외한다.
const NAV: { href: string; labelKey: 'dashboard' | 'products' | 'eventPasses' | 'orders' | 'sales' | 'checkin' | 'reviews' | 'qna' | 'feedback' | 'profile'; icon: LucideIcon }[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/products', labelKey: 'products', icon: Package },
  { href: '/event-passes', labelKey: 'eventPasses', icon: TicketCheck },
  { href: '/orders', labelKey: 'orders', icon: ShoppingCart },
  { href: '/sales', labelKey: 'sales', icon: Receipt },
  { href: '/checkin', labelKey: 'checkin', icon: QrCode },
  { href: '/reviews', labelKey: 'reviews', icon: Star },
  { href: '/qna', labelKey: 'qna', icon: MessageSquare },
  { href: '/feedback', labelKey: 'feedback', icon: ClipboardList },
  { href: '/profile', labelKey: 'profile', icon: Building2 },
];

export function PartnerSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const t = useT();
  const loc = useLocaleControl(); // 전역 입력 언어 토글
  const [open, setOpen] = useState(false); // 모바일 드로어
  const [loggingOut, setLoggingOut] = useState(false);

  const LangToggle = loc ? (
    <div className="flex items-center gap-1">
      {(['en', 'ko'] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => loc.setLocale(l)}
          className={cn(
            'rounded-pill px-2 py-0.5 text-[11px] font-semibold uppercase transition-colors',
            loc.locale === l ? 'bg-black text-white' : 'bg-grey-100 text-grey-500',
          )}
        >
          {l === 'en' ? 'EN' : 'KO'}
        </button>
      ))}
    </div>
  ) : null;

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // local 스코프: 서버 revoke 왕복 없이 로컬 세션만 즉시 제거 → 한 번에 확실히.
      await createClient().auth.signOut({ scope: 'local' });
    } catch {
      // 실패해도 하드 내비로 서버가 비워진 쿠키를 다시 읽으니 진행
    }
    window.location.assign('/login');
  }

  const NavList = (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
      {NAV.map(({ href, labelKey, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-pill px-4 py-2.5 text-sm transition-colors duration-200',
              active ? 'bg-black text-white' : 'text-grey-700 hover:bg-grey-100',
            )}
          >
            <Icon size={18} /> {t.nav[labelKey]}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* 모바일 상단바 */}
      {/* 스크롤해도 메뉴가 손에 닿게 위에 붙인다. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-grey-200 bg-white px-4 py-3 md:hidden">
        <span className="font-display text-lg uppercase tracking-tight">123Band Organizer</span>
        <div className="flex items-center gap-3">
          {LangToggle}
          <button onClick={() => setOpen(true)} aria-label="메뉴 열기" className="-m-2 p-2"><Menu size={24} /></button>
        </div>
      </header>

      {/* 모바일 드로어 오버레이 */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* 사이드바: 모바일=드로어, PC=고정 */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-grey-200 bg-white transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-grey-200 px-5 py-4">
          <span className="font-display text-lg uppercase tracking-tight">123Band Organizer</span>
          <div className="flex items-center gap-2">
            {LangToggle}
            <button className="md:hidden" onClick={() => setOpen(false)} aria-label="닫기"><X size={20} /></button>
          </div>
        </div>
        {NavList}
        <div className="border-t border-grey-200 p-3">
          <p className="truncate px-2 pb-2 text-xs text-grey-500">{email}</p>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-pill px-4 py-2.5 text-sm text-grey-700 hover:bg-grey-100">
            <LogOut size={18} /> {t.nav.logout}
          </button>
        </div>
      </aside>
    </>
  );
}
