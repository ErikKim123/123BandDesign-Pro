// Design Ref: 업적관리 — 업적 목록의 카드 한 장. 뱃지 이미지가 주인공이고 나머지는 그 아래 요약.
// 목록에서 '뱃지가 어떻게 생겼는지'를 바로 확인하려고 표 대신 이 보기를 쓴다.
'use client';
import { Award } from 'lucide-react';
import { tr, trI18n } from '@/i18n/tr';
import { StatusBadge } from '@/components/form/StatusBadge';
import { conditionsSummary, trackLabel, type AchievementRow } from '@/lib/resource/configs/achievements';

export function AchievementCard({ row, eventName }: { row: AchievementRow; eventName?: string }) {
  const name = trI18n(row.name_i18n) || row.code;
  const points = Number(row.point_reward ?? 0);

  return (
    <div className="flex flex-col items-center gap-2 p-4 text-center">
      <div className="relative">
        {/* 뱃지 — 투명 PNG 가 많아 흰 바탕 위에 얹고 잘리지 않게 contain 으로 맞춘다.
            비활성이어도 원래 색 그대로 보여 준다(뱃지 디자인 확인용). 활성 여부는 아래 상태 배지로 본다. */}
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-grey-200 bg-grey-50">
          {row.badge_image_url ? (
            // 관리자 내부 도구라 next/image 대신 img 사용
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.badge_image_url}
              alt={name}
              className="h-full w-full object-contain p-1.5"
            />
          ) : (
            <Award size={32} className="text-grey-300" aria-hidden />
          )}
        </div>
        {/* 노출 순서 — 표의 '순서' 열을 대신한다. */}
        <span className="absolute -left-1 -top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-pill bg-black px-1.5 text-[11px] font-medium text-white">
          {row.sort_order ?? 0}
        </span>
      </div>

      <p className="line-clamp-2 text-sm font-medium text-ink">{name}</p>
      <p className="break-all font-mono text-[11px] text-grey-400">{row.code}</p>
      <p className="text-[11px] text-grey-500">{trackLabel(row.track)}</p>
      {/* 행사 전용 뱃지는 어느 행사 것인지 바로 보이게 */}
      {row.product_id ? (
        <span className="line-clamp-1 max-w-full rounded-pill bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {tr('행사 전용')} · {eventName || tr('삭제된 행사')}
        </span>
      ) : (
        <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-[11px] text-grey-500">{tr('공통')}</span>
      )}
      <p className="line-clamp-2 text-xs text-grey-600">{conditionsSummary(row.conditions)}</p>

      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
        {points > 0 && (
          <span className="rounded-pill bg-grey-100 px-2.5 py-0.5 text-[11px] font-medium text-grey-700">
            {points.toLocaleString()} P
          </span>
        )}
        {!row.badge_image_url && <StatusBadge status="미등록" tone="warn" />}
        <StatusBadge status={row.is_active ? '활성' : '비활성'} />
      </div>
    </div>
  );
}
