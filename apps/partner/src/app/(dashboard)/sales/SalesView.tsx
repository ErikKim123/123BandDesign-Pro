// 판매·정산 렌더(클라이언트) — 서버 page 가 데이터 주입. 전역 언어 토글에 맞춰 번역.
'use client';
import { Wallet } from 'lucide-react';
import { toDisplayAmount, pickI18n, type Currency } from '@123band/shared';
import { StatusBadge } from '@/components/form/StatusBadge';
import { useT } from '@/i18n/useT';
import { useGlobalLocale } from '@/lib/i18n/locale-context';
import type { PartnerSettlement, PartnerSaleRow } from '@/lib/queries/partner-stats';

function fmtMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currency as Currency,
    minimumFractionDigits: currency === 'KRW' ? 0 : 2,
  }).format(toDisplayAmount(minor, currency as Currency));
}

// 판매 행 상품명을 현재 언어로 표시
function saleName(r: PartnerSaleRow, locale: 'en' | 'ko'): string {
  const alt = locale === 'ko' ? 'en' : 'ko';
  return pickI18n(r.nameI18n ?? undefined, locale) || pickI18n(r.nameI18n ?? undefined, alt) || r.productName || '—';
}

export function SalesView({ data }: { data: PartnerSettlement }) {
  const t = useT();
  const locale = (useGlobalLocale().locale ?? 'en') as 'en' | 'ko';
  const { rows, gross, payout, commissionRate } = data;
  const currencies = Array.from(new Set([...Object.keys(gross), ...Object.keys(payout)]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl uppercase tracking-tight">{t.sales.title}</h1>
        <span className="label-caps text-grey-500">{t.sales.commissionRate((commissionRate * 100).toFixed(1))}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {currencies.length === 0 ? (
          <div className="rounded-lg border border-grey-200 p-4 text-grey-500">{t.sales.noSettlement}</div>
        ) : (
          currencies.map((c) => (
            <div key={c} className="rounded-lg border border-grey-200 p-4">
              <div className="flex items-center gap-2 text-grey-400">
                <Wallet size={16} />
                <span className="label-caps">{c} {t.sales.payoutDueSuffix}</span>
              </div>
              <p className="mt-2 font-display text-2xl">{fmtMoney(payout[c] ?? 0, c)}</p>
              <p className="mt-1 text-xs text-grey-500">
                {t.sales.grossLabel} {fmtMoney(gross[c] ?? 0, c)} − {t.sales.feeLabel} {fmtMoney((gross[c] ?? 0) - (payout[c] ?? 0), c)}
              </p>
            </div>
          ))
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg uppercase tracking-tight">{t.sales.history}</h2>
        <div className="overflow-hidden rounded-lg border border-grey-200">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-grey-500">{t.sales.noHistory}</p>
          ) : (
            <>
            {/* 폰: 카드 목록 */}
            <ul className="md:hidden">
              {rows.map((r) => {
                const settle = Math.round(r.lineAmount * (1 - commissionRate));
                const excluded = r.orderStatus === 'cancelled' || r.orderStatus === 'refunded';
                return (
                  <li key={r.id} className="border-b border-grey-100 px-4 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium">{saleName(r, locale)}</span>
                      {r.orderStatus ? <StatusBadge status={r.orderStatus} /> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-grey-500">
                      {r.buyerName ?? '—'} · {r.orderNo ?? '—'} · {r.createdAt ? String(r.createdAt).slice(0, 10) : '—'}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-sm">
                      <span className="text-grey-700">
                        {fmtMoney(r.lineAmount, r.currency)} <span className="text-xs text-grey-400">× {r.qty}</span>
                      </span>
                      <span className="font-medium">
                        {t.sales.colSettle}: {excluded ? <span className="text-grey-400">{t.sales.excluded}</span> : fmtMoney(settle, r.currency)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-grey-200 bg-grey-50 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t.sales.colProduct}</th>
                    <th className="px-4 py-2.5 font-medium">{t.sales.colBuyer}</th>
                    <th className="px-4 py-2.5 font-medium">{t.sales.colOrderNo}</th>
                    <th className="px-4 py-2.5 font-medium">{t.sales.colOrderStatus}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t.sales.colQty}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t.sales.colSold}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t.sales.colSettle}</th>
                    <th className="px-4 py-2.5 text-right font-medium">{t.sales.colOrderDate}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const settle = Math.round(r.lineAmount * (1 - commissionRate));
                    const excluded = r.orderStatus === 'cancelled' || r.orderStatus === 'refunded';
                    return (
                      <tr key={r.id} className="border-b border-grey-100 last:border-0">
                        <td className="px-4 py-2.5 font-medium">{saleName(r, locale)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-grey-700">{r.buyerName ?? '—'}</td>
                        <td className="px-4 py-2.5 text-grey-600">{r.orderNo ?? '—'}</td>
                        <td className="px-4 py-2.5">{r.orderStatus ? <StatusBadge status={r.orderStatus} /> : '—'}</td>
                        <td className="px-4 py-2.5 text-right">{r.qty}</td>
                        <td className="px-4 py-2.5 text-right">{fmtMoney(r.lineAmount, r.currency)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {excluded ? <span className="text-grey-400">{t.sales.excluded}</span> : fmtMoney(settle, r.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-grey-400">
                          {r.createdAt ? String(r.createdAt).slice(0, 10) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-grey-400">{t.sales.footnote}</p>
      </div>
    </div>
  );
}
