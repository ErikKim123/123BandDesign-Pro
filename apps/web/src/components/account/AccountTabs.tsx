// 마이페이지 탭 네비게이션 — 알림 / 주문내역 / 선물함 / 포인트 / 스탬프 / 업적·뱃지 / 소셜.
// 각 탭은 기존 라우트를 그대로 가리키고, 현재 경로로 활성 탭을 판정한다.
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Package, Gift, Coins, Stamp, Award, Heart, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  notices: Bell,
  orders: Package,
  gifts: Gift,
  points: Coins,
  stamps: Stamp,
  badges: Award,
  social: Heart,
};

export interface AccountTabItem {
  /** ICONS 키이자 /account/{key} 세그먼트 */
  key: string;
  label: string;
  /**
   * 확인하지 않은 새 소식 개수. 누적 개수가 아니라 알림이므로 탭에 들어가면 사라진다.
   * (0/빈값이면 배지 자체를 숨김)
   */
  badge?: string | null;
}

export function AccountTabs({ locale, tabs }: { locale: string; tabs: AccountTabItem[] }) {
  const pathname = usePathname();

  return (
    // 아이콘 중심 탭 — 라벨을 전부 펼치면 5개가 한 줄을 넘겨 가로 스크롤이 생긴다.
    // 아이콘만 두고 "지금 보고 있는 탭"에만 라벨을 붙여 폭을 줄이면서 현재 위치는 남긴다.
    // 개수/포인트는 아이콘 우상단 배지로.
    <div className="overflow-x-auto">
      <nav className="flex min-w-max justify-center gap-1 border-b border-grey-200 sm:gap-2">
        {tabs.map((t) => {
          const href = `/${locale}/account/${t.key}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = ICONS[t.key] ?? Package;
          return (
            <Link
              key={t.key}
              href={href}
              title={t.label}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-grey-500 hover:text-ink'
              }`}
            >
              <span className="relative flex items-center">
                <Icon size={20} aria-hidden />
                {t.badge ? (
                  // 안 본 새 소식만 남으므로 활성/비활성과 무관하게 항상 눈에 띄는 색으로.
                  <span className="absolute -right-2.5 -top-1.5 min-w-[16px] rounded-pill bg-primary px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-white ring-2 ring-white">
                    {t.badge}
                  </span>
                ) : null}
              </span>
              {active && <span className="text-sm font-semibold">{t.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
