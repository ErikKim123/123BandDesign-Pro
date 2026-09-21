// Design Ref: 스탬프관리 — 증감 표기(적립=success / 소진·차감=danger). 목록 셀에서 함수 호출로 사용.
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';

/** 도장 수 표기 — 한국어는 "5개", 영어는 단위 없이 "5"(카탈로그의 '{n}개' 항목). */
export function stampUnit(n: number): string {
  return tr('{n}개').replace('{n}', Number(n ?? 0).toLocaleString());
}

export function StampDelta({ value }: { value: number }) {
  const v = Number(value ?? 0);
  return (
    <span className={cn('font-medium tabular-nums', v >= 0 ? 'text-success' : 'text-danger')}>
      {v > 0 ? '+' : ''}
      {stampUnit(v)}
    </span>
  );
}
