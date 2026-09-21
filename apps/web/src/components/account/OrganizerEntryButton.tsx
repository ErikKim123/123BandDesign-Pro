// 마이페이지 맨 아래, 로그아웃 옆의 작은 오거나이저 버튼.
//
// 예전에는 프로필 바로 밑에 큰 카드로 있었다. 하지만 마이페이지에 오는 사람은 대부분 표를
// 산 손님이지 행사를 여는 주최자가 아니다 — 가장 눈에 띄는 자리를 소수를 위한 권유가
// 차지하고 있었던 셈이다. 계정을 다루는 줄(로그아웃·회원탈퇴)로 내리고 크기를 줄였다.
//
// 세 가지 중 하나만 뜬다:
//   · 신청 전 — [오거나이저 신청]
//   · 심사 중 — [심사 중]        (눌러서 낸 내용을 다시 본다)
//   · 반려    — [신청 반려됨]    (눌러서 사유를 보고 다시 낸다)
// 승인된 오거나이저에게는 뜨지 않는다 — 같은 줄의 포털 진입 버튼이 그 자리를 대신한다.
import Link from 'next/link';
import { Clock, Store, XCircle } from 'lucide-react';
import type { Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';

export function OrganizerEntryButton({
  locale,
  status,
  t,
}: {
  locale: Locale;
  /** partners.status — 신청한 적이 없으면 null. */
  status: string | null;
  t: Dictionary['organizer'];
}) {
  if (status === 'suspended') return null;

  const rejected = status === 'rejected';
  const pending = status === 'pending';

  return (
    <Link
      href={`/${locale}/account/organizer`}
      className={`btn btn-secondary btn-sm w-fit ${rejected ? 'text-danger' : ''}`}
    >
      {rejected ? <XCircle size={16} /> : pending ? <Clock size={16} /> : <Store size={16} />}
      {rejected ? t.entryRejected : pending ? t.entryPending : t.entryApply}
    </Link>
  );
}
