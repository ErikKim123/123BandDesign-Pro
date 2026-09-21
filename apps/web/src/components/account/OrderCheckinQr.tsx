// 주문 입장 확인용 QR — 주문내역에 표시. 오거나이저가 스캔할 때마다 입장 수가 -1 씩 차감된다.
// admitted/total(입장 처리 수 / 총 입장 가능 수)로 상태를 판정: admitted>=total 이면 소진(입장완료).
// QR 값은 주문 식별 URL(체크인 경로 + 주문 id). react-qr-code 는 SVG 로 렌더(무 브라우저 의존).
'use client';
import type { ReactNode } from 'react';
import { CheckCircle2, Clock, Ticket } from 'lucide-react';
import QRCode from 'react-qr-code';

export function OrderCheckinQr({
  value,
  orderNo,
  label,
  hint,
  admitted = 0,
  total = 0,
  checkedInLabel,
  checkedInHint,
  checkedInAtLabel,
  checkedInAtText,
  admissionsLabel,
  remainingLabel,
  unitLabel,
  action,
}: {
  value: string;
  orderNo: string;
  label: string;
  hint: string;
  /** 입장 처리된 수 (스캔 누적) */
  admitted?: number;
  /** 총 입장 가능 수 (티켓 수량 합) */
  total?: number;
  checkedInLabel: string;
  checkedInHint: string;
  /** 입장 시각 라벨 (예: "입장 시각") */
  checkedInAtLabel?: string;
  /** 최초 입장 시각 — 연·월·일 시:분:초 (KST). admitted>0 일 때 표시 */
  checkedInAtText?: string;
  /** "입장" 라벨 — 카운터 표기에 사용 (예: "입장 1 / 3") */
  admissionsLabel?: string;
  /** "남은 입장" 라벨 */
  remainingLabel?: string;
  /** 개별 티켓(1매) 모드의 매수 표기 (예: "1 / 2"). 있으면 매수 배지 노출. */
  unitLabel?: string;
  /** 우측 액션 슬롯 (예: 삭제 버튼) — 소진된 주문에서 노출 */
  action?: ReactNode;
}) {
  const checkedIn = total > 0 && admitted >= total; // 전량 소진
  const multiUse = total > 1; // 다회 입장 패스면 카운터 노출
  const remaining = Math.max(0, total - admitted);

  return (
    <div className="flex flex-col items-center gap-4 border-t border-grey-100 py-4 sm:flex-row sm:items-center">
      {/* 모바일: 크게(세로 중앙) / 데스크톱: 적당히(가로). SVG 는 컨테이너에 맞춰 스케일. */}
      <div className="relative w-full max-w-[260px] shrink-0 rounded-lg border border-grey-200 bg-white p-3 sm:w-44 sm:p-2">
        {/* 전량 소진 시에만 QR 을 흐리게 (부분 입장이면 계속 스캔 가능하도록 유지) */}
        <div className={checkedIn ? 'opacity-20' : undefined}>
          <QRCode
            value={value}
            level="M"
            size={256}
            viewBox="0 0 256 256"
            style={{ height: 'auto', width: '100%', maxWidth: '100%' }}
          />
        </div>
        {checkedIn && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-1.5 rounded-pill bg-success px-3 py-1.5 text-sm font-semibold text-white shadow">
              <CheckCircle2 size={16} /> {checkedInLabel}
            </span>
          </div>
        )}
      </div>
      <div className="min-w-0 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <p className="label-caps text-grey-500">{checkedIn ? checkedInLabel : label}</p>
          {unitLabel && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-cream px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Ticket size={11} /> {unitLabel}
            </span>
          )}
        </div>
        <p className="mt-1 break-all font-mono text-[11px] text-grey-400">{orderNo}</p>

        {/* 다회 입장 카운터 — 스캔마다 admitted 가 오르고 남은 입장이 -1 씩 줄어든다 */}
        {multiUse && (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="text-sm font-semibold text-ink">
              {admissionsLabel} {admitted} / {total}
            </span>
            {!checkedIn && (
              <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {remainingLabel} {remaining}
              </span>
            )}
          </div>
        )}

        <p className="mt-1 text-xs text-grey-400">{checkedIn ? checkedInHint : hint}</p>

        {/* 최초 입장 시각 — 연·월·일 시:분:초 */}
        {admitted > 0 && checkedInAtText && (
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs font-medium text-success sm:justify-start">
            <Clock size={13} className="shrink-0" />
            <span className="break-words">
              {checkedInAtLabel && <span className="text-grey-400">{checkedInAtLabel} </span>}
              {checkedInAtText}
            </span>
          </p>
        )}
      </div>

      {/* 우측 액션(삭제 등) — 데스크톱은 오른쪽 끝, 모바일은 하단 */}
      {action && <div className="sm:ml-auto sm:self-start">{action}</div>}
    </div>
  );
}
