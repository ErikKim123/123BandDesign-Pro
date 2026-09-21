// Design Ref: 포인트관리 — 증감 표기(적립=success / 차감=danger). 목록 셀에서 함수 호출로 사용.
import { cn } from '@/lib/utils';

export function PointDelta({ value }: { value: number }) {
  const v = Number(value ?? 0);
  return (
    <span className={cn('font-medium tabular-nums', v >= 0 ? 'text-success' : 'text-danger')}>
      {v > 0 ? '+' : ''}
      {v.toLocaleString()} P
    </span>
  );
}
