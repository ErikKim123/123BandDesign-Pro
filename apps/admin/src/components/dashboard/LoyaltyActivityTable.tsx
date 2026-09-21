// Design Ref: §5 대시보드 — 포인트·스탬프 활동 타임라인.
// 두 원장을 합쳐 보여주므로 "종류" 칸으로 무엇의 증감인지 구분한다.
// 구분(reason) 라벨은 각 관리화면의 목록과 같은 사전을 쓴다 — 화면마다 다른 말이 나오지 않게.
import Link from 'next/link';
import { Coins, Stamp } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { reasonLabel, fmtDateTime } from '@/lib/resource/configs/point-ledger';
import { stampReasonLabel } from '@/lib/resource/configs/stamp-ledger';
import type { LoyaltyActivity } from '@/lib/queries/loyalty';

function memberLabel(m: LoyaltyActivity['member']): string {
  if (!m?.email) return '—';
  return m.name ? `${m.name} · ${m.email}` : m.email;
}

export function LoyaltyActivityTable({ rows }: { rows: LoyaltyActivity[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-grey-200">
        <p className="px-4 py-10 text-center text-grey-500">{tr('활동 없음.')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-grey-200">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b border-grey-200 bg-grey-50 text-left">
            <tr>
              <th className="px-4 py-2.5 font-medium">{tr('일시')}</th>
              <th className="px-4 py-2.5 font-medium">{tr('종류')}</th>
              <th className="px-4 py-2.5 font-medium">{tr('회원')}</th>
              <th className="px-4 py-2.5 font-medium">{tr('구분')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{tr('증감')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{tr('이후')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isPoint = r.kind === 'point';
              const Icon = isPoint ? Coins : Stamp;
              const unit = isPoint ? ' P' : '';
              return (
                <tr key={r.id} className="border-b border-grey-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-grey-500">
                    {fmtDateTime(r.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link
                      href={isPoint ? '/points' : '/stamps'}
                      className="inline-flex items-center gap-1.5 text-grey-600 transition-colors hover:text-ink"
                    >
                      <Icon size={14} />
                      {isPoint ? tr('포인트') : tr('스탬프')}
                    </Link>
                  </td>
                  <td className="max-w-[18rem] truncate px-4 py-2.5">{memberLabel(r.member)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {isPoint ? reasonLabel(r.reason) : stampReasonLabel(r.reason)}
                    {r.memo && <span className="ml-1.5 text-xs text-grey-400">{r.memo}</span>}
                  </td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums',
                      r.delta >= 0 ? 'text-success' : 'text-danger',
                    )}
                  >
                    {r.delta > 0 ? '+' : ''}
                    {r.delta.toLocaleString()}
                    {unit}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-grey-400">
                    {r.balanceAfter.toLocaleString()}
                    {unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
