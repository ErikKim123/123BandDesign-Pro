// 회원활동 — 통합 활동 타임라인. 전체 피드 탭과 회원 상세 드로어가 같이 쓴다.
// 표가 아니라 목록으로 그린다: 종류마다 의미 있는 값이 달라(증감/금액/별점/한마디)
// 공통 컬럼으로 묶으면 대부분의 칸이 비게 된다.
'use client';
import { tr } from '@/i18n/tr';
import { toDisplayAmount, type Currency } from '@123band/shared';
import { cn } from '@/lib/utils';
import { CharacterAvatar } from '@/components/member/CharacterAvatar';
import { fmtDateTime } from '@/lib/resource/configs/point-ledger';
import { KIND_META, kindDetail } from './kinds';
import type { ActivityFeedRow } from '@/lib/queries/member-activity';

function memberLabel(name: string | null, email: string | null, code: string | null): string {
  if (name) return email ? `${name} · ${email}` : name;
  return email || code || '—';
}

function fmtMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: currency as Currency,
      minimumFractionDigits: currency === 'KRW' ? 0 : 2,
    }).format(toDisplayAmount(minor, currency as Currency));
  } catch {
    return `${currency} ${minor.toLocaleString()}`;
  }
}

/** 오른쪽에 붙는 수치 — 종류마다 뜻이 다르다(원장=증감, 주문=금액, 쿠폰=차감 포인트). */
function RowValue({ row }: { row: ActivityFeedRow }) {
  if (row.kind === 'order' && row.amount != null) {
    return <span className="tabular-nums font-medium">{fmtMoney(row.amount, row.currency ?? 'KRW')}</span>;
  }
  if (row.delta != null) {
    const unit = row.kind === 'stamp' ? '' : ' P';
    return (
      <span className={cn('tabular-nums font-medium', row.delta >= 0 ? 'text-success' : 'text-danger')}>
        {row.delta > 0 ? '+' : ''}
        {row.delta.toLocaleString()}
        {unit}
        {row.balance_after != null && (
          <span className="ml-1.5 text-xs font-normal text-grey-400">
            → {row.balance_after.toLocaleString()}
            {unit}
          </span>
        )}
      </span>
    );
  }
  return null;
}

export function ActivityFeed({
  rows,
  loading,
  /** 회원 상세 드로어에서는 이미 누구인지 알고 있으므로 회원 줄을 숨긴다. */
  showMember = true,
  onMemberClick,
}: {
  rows: ActivityFeedRow[];
  loading?: boolean;
  showMember?: boolean;
  onMemberClick?: (userId: string) => void;
}) {
  if (loading) {
    return <p className="py-10 text-center text-sm text-grey-500">{tr('불러오는 중…')}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-grey-200 py-10 text-center text-sm text-grey-500">
        {tr('조건에 맞는 활동이 없습니다.')}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-grey-100 border-y border-grey-100">
      {rows.map((row) => {
        const meta = KIND_META[row.kind];
        const Icon = meta?.icon;
        const detail = kindDetail(row);
        // 상대가 있는 활동(하트·추천)은 "누구와" 가 본문의 핵심이다.
        const counterpart =
          row.counterpart_id && (row.kind === 'heart_in' || row.kind === 'heart_out' || row.kind === 'referral')
            ? memberLabel(row.counterpart_name, row.counterpart_email, row.counterpart_code)
            : null;

        return (
          <li key={row.id} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-grey-100 text-grey-600">
              {Icon ? <Icon size={15} /> : null}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">{tr(meta?.label ?? row.kind)}</span>
                {detail && <span className="text-grey-600">{tr(detail)}</span>}
                {row.title && <span className="truncate text-grey-600">· {row.title}</span>}
                {counterpart && (
                  <span className="text-grey-500">
                    {row.kind === 'heart_out' ? '→' : '←'} {counterpart}
                  </span>
                )}
              </p>

              {row.detail && (
                <p className="mt-0.5 truncate text-xs text-grey-500">{row.detail}</p>
              )}

              {showMember && (
                <button
                  type="button"
                  onClick={() => onMemberClick?.(row.user_id)}
                  className="mt-1 flex items-center gap-1.5 text-xs text-grey-500 transition-colors hover:text-black"
                >
                  <CharacterAvatar
                    seed={row.member_avatar_seed}
                    traits={row.member_avatar_traits}
                    photoUrl={row.member_avatar_url}
                    size={18}
                    className="shrink-0 rounded-full"
                  />
                  <span className="truncate">
                    {memberLabel(row.member_name, row.member_email, row.member_code)}
                  </span>
                </button>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-0.5 text-sm">
              <RowValue row={row} />
              <span className="whitespace-nowrap text-xs text-grey-400">
                {fmtDateTime(row.occurred_at)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
