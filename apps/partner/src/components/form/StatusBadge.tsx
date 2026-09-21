// Design Ref: §3.2 / 백오피스 badges — ALL CAPS, 시맨틱 색만
import { cn } from '@/lib/utils';

const TONE: Record<string, string> = {
  // 상태 → 톤
  active: 'bg-success/10 text-success',
  pending: 'bg-live/10 text-live',
  suspended: 'bg-danger/10 text-danger',
  draft: 'bg-grey-200 text-grey-600',
  soldout: 'bg-grey-200 text-grey-600',
  paid: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger',
  refunded: 'bg-danger/10 text-danger',
  default: 'bg-grey-100 text-grey-700',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-tight',
        TONE[status] ?? TONE.default,
      )}
    >
      {status}
    </span>
  );
}
