// Design Ref: §3.2 / 백오피스 badges — ALL CAPS, 시맨틱 색만
import { cn } from '@/lib/utils';
import { tr } from '@/i18n/tr';

const TONE: Record<string, string> = {
  // 상태 → 톤
  active: 'bg-success/10 text-success',
  pending: 'bg-live/10 text-live',
  suspended: 'bg-danger/10 text-danger',
  draft: 'bg-grey-200 text-grey-600',
  soldout: 'bg-grey-200 text-grey-600',
  inactive: 'bg-danger/10 text-danger',
  paid: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger',
  refunded: 'bg-danger/10 text-danger',
  default: 'bg-grey-100 text-grey-700',
};

// 상태 문자열이 영문 키가 아닌 경우(한글 라벨 등) 톤을 직접 지정한다.
const EXPLICIT_TONE = {
  success: 'bg-success/10 text-success',
  warn: 'bg-live/10 text-live',
  danger: 'bg-danger/10 text-danger',
  default: 'bg-grey-100 text-grey-700',
} as const;

export function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: 'success' | 'warn' | 'danger' | 'default';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-tight',
        tone ? EXPLICIT_TONE[tone] : (TONE[status] ?? TONE.default),
      )}
    >
      {tr(status)}
    </span>
  );
}
