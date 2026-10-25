// Design Ref: §5.3 / 백오피스 — 반응형 사이드바 (PC: 고정, 모바일: 드로어)
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Store, Package, TicketCheck, FolderTree, ShoppingCart, Truck,
  MessageSquare, Star, HelpCircle, BellRing, Image, LayoutGrid, Ticket, Coins, Stamp, Award, Heart, Mail, Menu, ListTree, Settings, Instagram, Trophy, Medal, ListOrdered, UsersRound, Swords, Gavel, X, LogOut, BarChart3, Filter, CalendarRange, Activity, Radio,
  type LucideIcon, 
  MailCheck, 
  ListChecks,
  ScanLine,
  FileSignature,
  Presentation,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/locale/LocaleContext';
import { LocaleSwitcher } from './LocaleSwitcher';
import { cn } from '@/lib/utils';

// Design Ref: §1.1 가이드 9개 관리 메뉴 (Phase 1 전체 활성화). 라벨은 슬러그→사전 매핑.
const NAV: { href: string; slug: string; icon: LucideIcon; disabled?: boolean; newTab?: boolean }[] = [
  { href: '/dashboard', slug: 'dashboard', icon: LayoutDashboard },
  { href: '/desk', slug: 'desk', icon: ScanLine },
  { href: '/traffic', slug: 'traffic', icon: BarChart3 },
  { href: '/funnel', slug: 'funnel', icon: Filter },
  { href: '/weekly', slug: 'weekly', icon: CalendarRange },
  { href: '/members', slug: 'members', icon: Users },
  { href: '/member-activity', slug: 'member-activity', icon: Activity },
  { href: '/notices', slug: 'notices', icon: BellRing },
  { href: '/organizer-contracts', slug: 'organizer-contracts', icon: FileSignature },
  { href: '/partners', slug: 'partners', icon: Store },
  { href: '/products', slug: 'products', icon: Package },
  { href: '/event-passes', slug: 'event-passes', icon: TicketCheck },
  { href: '/live', slug: 'live', icon: Radio },
  { href: '/jnj', slug: 'jnj', icon: Trophy },
  { href: '/jnj-divisions', slug: 'jnj-divisions', icon: Swords },
  { href: '/jnj-judges', slug: 'jnj-judges', icon: Gavel },
  { href: '/jnj-winners', slug: 'jnj-winners', icon: Medal },
  { href: '/jnj-scores', slug: 'jnj-scores', icon: ListOrdered },
  { href: '/jnj-participants', slug: 'jnj-participants', icon: UsersRound },
  { href: '/jnj-reviews', slug: 'jnj-reviews', icon: Star },
  { href: '/categories', slug: 'categories', icon: FolderTree },
  { href: '/orders', slug: 'orders', icon: ShoppingCart },
  { href: '/shipments', slug: 'shipments', icon: Truck },
  { href: '/boards', slug: 'boards', icon: MessageSquare },
  { href: '/product-reviews', slug: 'product-reviews', icon: Star },
  { href: '/product-qna', slug: 'product-qna', icon: HelpCircle },
  { href: '/banners', slug: 'banners', icon: Image },
  { href: '/menus', slug: 'menus', icon: ListTree },
  { href: '/main-sections', slug: 'main-sections', icon: LayoutGrid },
  { href: '/coupons', slug: 'coupons', icon: Ticket },
  { href: '/points', slug: 'points', icon: Coins },
  { href: '/stamps', slug: 'stamps', icon: Stamp },
  { href: '/achievements', slug: 'achievements', icon: Award },
  { href: '/social', slug: 'social', icon: Heart },
  { href: '/newsletter', slug: 'newsletter', icon: Mail },
  { href: '/mail-templates', slug: 'mail-templates', icon: MailCheck },
  { href: '/instagram', slug: 'instagram', icon: Instagram },
  // 전체화면 에디터(사이드바 없음) + Blueprint 전역 CSS 가 다른 화면에 남지 않도록 새 탭으로 연다
  { href: '/ir-tool', slug: 'ir-tool', icon: Presentation, newTab: true },
  { href: '/code-values', slug: 'code-values', icon: ListChecks },
  { href: '/settings', slug: 'settings', icon: Settings },
];

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false); // 모바일 드로어

  async function logout() {
    try {
      // local 스코프: 현재 세션만 서버에서 즉시 revoke (다른 기기 세션은 유지)
      await createClient().auth.signOut({ scope: 'local' });
    } catch {
      // 실패해도 하드 내비로 서버가 비워진 쿠키를 다시 읽으니 진행
    }
    // 하드 내비게이션: RSC 캐시를 버리고 비워진 쿠키로 재렌더 — 즉시 로그아웃 반영
    window.location.replace('/login');
  }

  const NavList = (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
      {NAV.map(({ href, slug, icon: Icon, disabled, newTab }) => {
        // 정확히 일치하거나 하위 경로일 때만 활성 — 접두어만 겹치는 메뉴(/jnj vs /jnj-winners)가 같이 켜지지 않게.
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const label = t.nav[slug] ?? slug;
        if (disabled)
          return (
            <span key={href} className="flex cursor-not-allowed items-center gap-3 rounded-pill px-4 py-2.5 text-sm text-grey-400">
              <Icon size={18} /> {label}
              <span className="ml-auto text-[10px] uppercase">soon</span>
            </span>
          );
        return (
          <Link
            key={href}
            href={href}
            target={newTab ? '_blank' : undefined}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-pill px-4 py-2.5 text-sm transition-colors duration-200',
              active ? 'bg-black text-white' : 'text-grey-700 hover:bg-grey-100',
            )}
          >
            <Icon size={18} /> {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* 모바일 상단바 */}
      {/* 스크롤해도 메뉴가 손에 닿게 위에 붙인다 — 폰에서 긴 목록 아래에서 메뉴로 돌아갈 길이 없었다. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-grey-200 bg-white px-4 py-3 md:hidden">
        <span className="font-display text-lg uppercase tracking-tight">{t.appName}</span>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <button onClick={() => setOpen(true)} aria-label={t.openMenu} className="-m-2 p-2"><Menu size={24} /></button>
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
          <span className="font-display text-lg uppercase tracking-tight">{t.appName}</span>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <button className="md:hidden" onClick={() => setOpen(false)} aria-label={t.close}><X size={20} /></button>
          </div>
        </div>
        {NavList}
        <div className="border-t border-grey-200 p-3">
          <p className="truncate px-2 pb-2 text-xs text-grey-500">{email}</p>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-pill px-4 py-2.5 text-sm text-grey-700 hover:bg-grey-100">
            <LogOut size={18} /> {t.logout}
          </button>
        </div>
      </aside>
    </>
  );
}
