// 대시보드 렌더(클라이언트) — 서버 page 가 데이터 주입. 전역 언어 토글에 맞춰 번역.
'use client';
import { Package, CheckCircle2, Receipt, Wallet, Ticket } from 'lucide-react';
import { toDisplayAmount, pickI18n, type Currency } from '@123band/shared';
import { StatusBadge } from '@/components/form/StatusBadge';
import { useT } from '@/i18n/useT';
import { useGlobalLocale } from '@/lib/i18n/locale-context';
import type { PartnerStats, PartnerSaleRow } from '@/lib/queries/partner-stats';

function fmtMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currency as Currency,
    minimumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(toDisplayAmount(minor, currency as Currency));
}

function moneyText(map: Record<string, number>): string {
  return (
    Object.entries(map)
      .map(([c, v]) => fmtMoney(v, c))
      .join(' · ') || '—'
  );
}

// 판매 행의 상품명을 현재 언어로 표시 (없으면 다른 언어 → 서버 폴백)
function saleName(r: PartnerSaleRow, locale: 'en' | 'ko'): string {
  const alt = locale === 'ko' ? 'en' : 'ko';
  return pickI18n(r.nameI18n ?? undefined, locale) || pickI18n(r.nameI18n ?? undefined, alt) || r.productName || '—';
}

export function DashboardView({ stats: s }: { stats: PartnerStats }) {
  const t = useT();
  const locale = (useGlobalLocale().locale ?? 'en') as 'en' | 'ko';

  const cards = [
    { label: t.dashboard.myProducts, value: String(s.productCount), icon: Package },
    { label: t.dashboard.eventPasses, value: String(s.eventPassCount), icon: Ticket },
    { label: t.dashboard.onSale, value: String(s.activeProductCount), icon: CheckCircle2 },
    { label: t.dashboard.saleCount, value: String(s.saleItemCount), icon: Receipt },
    { label: t.dashboard.grossTotal, value: moneyText(s.gross), icon: Receipt },
    {
      label: t.dashboard.payoutDue((s.commissionRate * 100).toFixed(1)),
      value: moneyText(s.payout),
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl uppercase tracking-tight">{t.dashboard.title}</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-grey-200 p-4">
            <div className="flex items-center gap-2 text-grey-400">
              <Icon size={16} />
              <span className="label-caps">{label}</span>
            </div>
            <p className="mt-2 truncate font-display text-2xl">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{t.dashboard.recentSales}</h2>
        <div className="overflow-hidden rounded-lg border border-grey-200">
          {s.recentSales.length === 0 ? (
            <p className="px-4 py-10 text-center text-grey-500">{t.dashboard.noSales}</p>
          ) : (
            <>
            {/* 폰: 카드 목록 */}
            <ul className="md:hidden">
              {s.recentSales.map((r) => (
                <li key={r.id} className="border-b border-grey-100 px-4 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words font-medium">{saleName(r, locale)}</span>
                    {r.orderStatus ? <StatusBadge status={r.orderStatus} /> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-grey-500">
                    {r.buyerName ?? '—'} · {r.orderNo ?? '—'} · {r.createdAt ? String(r.createdAt).slice(0, 10) : '—'}
                  </p>
                  <p className="mt-1 text-sm">
                    {fmtMoney(r.lineAmount, r.currency)} <span className="text-xs text-grey-400">× {r.qty}</span>
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-grey-200 bg-grey-50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t.dashboard.colOrderDate}</th>
                    <th className="px-4 py-2.5 font-medium">{t.dashboard.colProduct}</th>
                    <th className="px-4 py-2.5 font-medium">{t.dashboard.colBuyer}</th>
                    <th className="px-4 py-2.5 font-medium">{t.dashboard.colOrderNo}</th>
                    <th className="px-4 py-2.5 font-medium">{t.dashboard.colStatus}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t.dashboard.colQty}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t.dashboard.colAmount}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentSales.map((r) => (
                    <tr key={r.id} className="border-b border-grey-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-grey-500">
                        {r.createdAt ? String(r.createdAt).slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{saleName(r, locale)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-grey-700">{r.buyerName ?? '—'}</td>
                      <td className="px-4 py-2.5 text-grey-600">{r.orderNo ?? '—'}</td>
                      <td className="px-4 py-2.5">{r.orderStatus ? <StatusBadge status={r.orderStatus} /> : '—'}</td>
                      <td className="px-4 py-2.5 text-right">{r.qty}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoney(r.lineAmount, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
