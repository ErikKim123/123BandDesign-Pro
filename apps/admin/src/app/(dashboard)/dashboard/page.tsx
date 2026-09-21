// Design Ref: §5 — 관리자 대시보드 (요약 통계 카드 + 최근 주문 + 포인트·스탬프 활동)
import Link from 'next/link';
import { ShoppingCart, DollarSign, Users, Store, Package, BarChart3, Coins, Stamp } from 'lucide-react';
import { tr, trI18n } from '@/i18n/tr';
import { toDisplayAmount, type Currency } from '@123band/shared';
import { StatusBadge } from '@/components/form/StatusBadge';
import { getDashboardStats, type RecentOrder } from '@/lib/queries/stats';
import { getTrafficStats } from '@/lib/queries/traffic';
import { getLoyaltyStats, getLoyaltyActivity } from '@/lib/queries/loyalty';
import { LoyaltyActivityTable } from '@/components/dashboard/LoyaltyActivityTable';

export const dynamic = 'force-dynamic';

function fmtMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currency as Currency,
    minimumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(toDisplayAmount(minor, currency as Currency));
}

/** 주문 상품명 — 여러 건이면 첫 상품명 + 나머지 건수(+N). 상품명이 비면 상품코드로 폴백. */
function productLabel(o: RecentOrder): string {
  const names = (o.order_items ?? [])
    .map((it) => (it.product ? trI18n(it.product.name_i18n) || it.product.code || '' : ''))
    .filter(Boolean);
  const first = names[0];
  if (!first) return '—';
  return names.length === 1 ? first : `${first} +${names.length - 1}`;
}

export default async function DashboardPage() {
  const [s, traffic, loyalty, activity] = await Promise.all([
    getDashboardStats(),
    getTrafficStats(1),
    getLoyaltyStats(),
    getLoyaltyActivity(10),
  ]);
  const revenueText =
    Object.entries(s.revenue)
      .map(([c, v]) => fmtMoney(v, c))
      .join(' · ') || '—';

  const cards = [
    { label: tr('주문'), value: String(s.orderCount), icon: ShoppingCart },
    { label: tr('매출 (결제완료)'), value: revenueText, icon: DollarSign },
    { label: tr('회원'), value: String(s.memberCount), icon: Users },
    { label: tr('오거나이저'), value: String(s.partnerCount), icon: Store },
    { label: tr('판매중 상품'), value: String(s.productCount), icon: Package },
    { label: tr('오늘 방문자'), value: String(traffic.today?.visitors ?? 0), icon: BarChart3, href: '/traffic' },
    // 포인트는 잔액이 곧 부채다 — 쌓인 총량을 상시로 본다.
    {
      label: tr('미사용 포인트'),
      value: `${loyalty.pointOutstanding.toLocaleString()} P`,
      icon: Coins,
      href: '/points',
    },
    // 스탬프는 "지금 카드를 모으는 중인 회원" — 카드가 차면 0 으로 돌아가므로 진행 중만 잡힌다.
    {
      label: tr('스탬프 진행 회원'),
      value: String(loyalty.stampHolders),
      icon: Stamp,
      href: '/stamps',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl uppercase tracking-tight">{tr('대시보드')}</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, href }) => {
          const body = (
            <>
              <div className="flex items-center gap-2 text-grey-400">
                <Icon size={16} />
                <span className="label-caps">{label}</span>
              </div>
              <p className="mt-2 truncate font-display text-2xl">{value}</p>
            </>
          );
          if (href) {
            return (
              <Link
                key={label}
                href={href}
                className="rounded-lg border border-grey-200 p-4 transition-colors hover:border-grey-400 hover:bg-grey-50"
              >
                {body}
              </Link>
            );
          }
          return (
            <div key={label} className="rounded-lg border border-grey-200 p-4">
              {body}
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{tr('최근 주문')}</h2>
        <div className="overflow-hidden rounded-lg border border-grey-200">
          {s.recentOrders.length === 0 ? (
            <p className="px-4 py-10 text-center text-grey-500">{tr('주문 없음.')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="border-b border-grey-200 bg-grey-50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{tr('주문번호')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('상품명')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('주문자명')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('이메일')}</th>
                    <th className="px-4 py-2.5 font-medium">{tr('상태')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('금액')}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{tr('주문일')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-grey-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium">{o.order_no}</td>
                      <td className="max-w-[16rem] truncate px-4 py-2.5">{productLabel(o)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{o.buyer?.name || '—'}</td>
                      <td className="max-w-[14rem] truncate px-4 py-2.5 text-grey-500">
                        {o.buyer?.email || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right">{fmtMoney(o.total_amount, o.currency)}</td>
                      <td className="px-4 py-2.5 text-right text-grey-400">
                        {String(o.created_at).slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 포인트·스탬프 활동 — 두 원장을 한 타임라인으로 합쳐 보여준다. */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg uppercase tracking-tight">{tr('포인트·스탬프 활동')}</h2>
          <p className="text-sm text-grey-500">
            {tr('카드 완성 누적')} <span className="tabular-nums">{loyalty.stampCardsDone}</span>
            {' · '}
            {tr('스탬프 지급 포인트')}{' '}
            <span className="tabular-nums">{loyalty.stampPointsPaid.toLocaleString()} P</span>
          </p>
        </div>
        <LoyaltyActivityTable rows={activity} />
      </div>
    </div>
  );
}
