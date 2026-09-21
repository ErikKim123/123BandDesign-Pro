// 마이페이지 셸 — 내 캐릭터 + 내 QR + 탭(주문내역/선물함/포인트/업적·뱃지/소셜).
// 기존에는 카드 리스트로 하위 페이지에 들어갔다가 뒤로가기로 돌아오는 구조였는데,
// 탭으로 바꾸면서 공통 헤더(캐릭터·QR·요약)를 이 레이아웃이 한 번만 그리고
// 하위 페이지는 본문만 담당한다.
import type { Locale } from '@123band/shared';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { requireCustomer } from '@/lib/auth/guard';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { PartnerPortalLink } from '@/components/auth/PartnerPortalLink';
import { OrganizerEntryButton } from '@/components/account/OrganizerEntryButton';
import { DeleteAccountButton } from '@/components/auth/DeleteAccountButton';
import { AccountProfileHeader } from '@/components/account/AccountProfileHeader';
import { AccountTabs, type AccountTabItem } from '@/components/account/AccountTabs';
import { AccountTabSeen } from '@/components/account/AccountTabSeen';
import { ReferralApply } from '@/components/social/Referral';
import { NotifySettings } from '@/components/social/NotifySettings';

export const dynamic = 'force-dynamic';

interface SocialSummary {
  name: string | null;
  social_code: string | null;
  avatar_seed: string | null;
  avatar_url: string | null;
  avatar_traits: unknown;
  blocked: boolean;
  hearts_received: number;
  hearts_given: number;
  referral_count: number;
}

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);

  // 세션 분리 규칙: web 은 고객 전용 (admin/partner 계정 차단)
  const user = await requireCustomer(locale, 'account');

  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, email, role, point_balance, notify_email_digest, tab_seen_at, gender')
    .eq('id', user.id)
    .maybeSingle();

  // 소셜 요약(코드/캐릭터 시드/하트·추천 수)은 RPC 한 번으로 가져온다.
  const { data: summaryRaw } = await supabase.rpc('my_social_summary');
  const summary = (summaryRaw ?? null) as SocialSummary | null;

  // 안 읽은 운영자 알림 — 알림 탭 배지. 알림함에 들어가면(mark_notices_read) 사라진다.
  const { data: unreadNoticesRaw } = await supabase.rpc('my_unread_notices');
  const unreadNotices = Number(unreadNoticesRaw ?? 0);

  // 아직 확인하지 않은 하트 — 소셜 탭 배지를 "알림"처럼 쓰기 위한 값.
  const { data: unreadRaw } = await supabase.rpc('my_unread_hearts');
  const unreadHearts = Number(unreadRaw ?? 0);

  // 탭 배지는 "알림"이다 — 마지막으로 그 탭을 본 뒤에 새로 생긴 것만 센다(확인하면 사라진다).
  // 본 시각은 profiles.tab_seen_at(jsonb)에 남고, 갱신은 AccountTabSeen(클라이언트)이 한다.
  // 한 번도 안 본 탭(값 없음)은 전체를 세서 일단 알린다 — 들어갔다 나오면 0 이 된다.
  const seenAt = (profile?.tab_seen_at ?? {}) as Record<string, string | null | undefined>;
  const since = (tab: string): string | null =>
    typeof seenAt[tab] === 'string' && seenAt[tab] ? (seenAt[tab] as string) : null;

  // 탭 배지용 개수 — RLS 로 본인 것만 집계된다(행은 가져오지 않고 count 만).
  const [
    { count: orderCount },
    { count: giftCount },
    { count: badgeCount },
    { count: pointCount },
    { count: stampCount },
    { data: stampPolicy },
  ] = await Promise.all([
      // 주문은 상태가 바뀌는 것(입금확인·발송 등)도 소식이라 updated_at 기준으로 본다.
      (() => {
        const q = supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .is('buyer_hidden_at', null)
          .neq('status', 'pending'); // 주문내역과 동일 — 결제대기(미결제)는 제외
        const s = since('orders');
        return s ? q.gt('updated_at', s) : q;
      })(),
      (() => {
        const q = supabase
          .from('gifts')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .eq('status', 'sent');
        const s = since('gifts');
        return s ? q.gt('created_at', s) : q;
      })(),
      (() => {
        const q = supabase.from('user_achievements').select('id', { count: 'exact', head: true });
        const s = since('badges');
        return s ? q.gt('earned_at', s) : q;
      })(),
      // 포인트는 잔액이 아니라 "새 적립·사용 내역 건수" — 잔액은 늘 있으니 알림이 될 수 없다.
      (() => {
        const q = supabase.from('point_ledger').select('id', { count: 'exact', head: true });
        const s = since('points');
        return s ? q.gt('created_at', s) : q;
      })(),
      // 스탬프도 같은 이유로 진행도가 아니라 "새 내역 건수"를 센다(카드 완성·쿠폰 발급 포함).
      (() => {
        const q = supabase.from('stamp_ledger').select('id', { count: 'exact', head: true });
        const s = since('stamps');
        return s ? q.gt('created_at', s) : q;
      })(),
      // 어드민이 스탬프 기능을 끄면(visible=false) 탭을 숨긴다.
      supabase.rpc('stamps_policy'),
    ]);
  const stampsVisible = (stampPolicy as { visible?: boolean } | null)?.visible !== false;

  // 표시 이름은 회원이 직접 정한 값만 쓴다 — 비어 있으면 헤더가 "이름을 입력해 주세요"로
  // 유도한다(이메일/구글 계정 식별자를 이름 자리에 노출하지 않는다).
  const displayName = summary?.name ?? profile?.name ?? null;
  // 탈퇴(소프트 삭제) 계정 — 이메일이 tombstone 으로 교체됨
  const isWithdrawn =
    (profile?.email ?? user.email ?? '').includes('@deleted.invalid') ||
    Boolean((user.user_metadata as Record<string, unknown> | undefined)?.withdrawn);
  // 오거나이저 여부 — 예전 계정은 role='partner', 쓰던 계정으로 승인받은 회원은
  // partners.status='active'(0116). 둘 중 하나면 포털로 들어갈 수 있다.
  const { data: partnerRow } = await supabase
    .from('partners')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  const organizerStatus = (partnerRow as { status?: string } | null)?.status ?? null;
  const isPartner = !isWithdrawn && (profile?.role === 'partner' || organizerStatus === 'active');
  const partnerBaseUrl =
    process.env.NEXT_PUBLIC_PARTNER_URL ?? 'https://123band-partner.vercel.app';

  const heartsReceived = Number(summary?.hearts_received ?? 0);
  // 배지에 남는 건 전부 "확인 안 한 새 소식"이다 → 전부 강조색(highlight).
  // 두 자리를 넘어가면 아이콘을 덮으므로 99+ 로 자른다.
  const newBadge = (n: number | null | undefined): string | null =>
    n && n > 0 ? (n > 99 ? '99+' : String(n)) : null;

  const tabs: AccountTabItem[] = [
    // 운영자가 보낸 메시지 — 지금 온 소식이라 맨 앞에 둔다.
    { key: 'notices', label: dict.notices.entry, badge: newBadge(unreadNotices) },
    { key: 'orders', label: dict.orders.title, badge: newBadge(orderCount) },
    { key: 'gifts', label: dict.gifts.entry, badge: newBadge(giftCount) },
    { key: 'points', label: dict.points.entry, badge: newBadge(pointCount) },
    ...(stampsVisible
      ? [{ key: 'stamps' as const, label: dict.stamps.entry, badge: newBadge(stampCount) }]
      : []),
    { key: 'badges', label: dict.badges.entry, badge: newBadge(badgeCount) },
    // 안 읽은 하트만 — 읽고 나면(소셜 탭 진입 시 mark_hearts_read) 사라진다.
    { key: 'social', label: dict.social.entry, badge: newBadge(unreadHearts) },
  ];
  // 지금 배지가 떠 있는 탭 — 그 탭에 들어갔을 때만 "봤다"를 기록하면 된다(불필요한 왕복 방지).
  const pendingTabs = tabs.filter((t) => t.badge).map((t) => t.key);

  return (
    <div className="container-band max-w-3xl py-8">
      {/* 추천 QR 로 들어온 신규 회원 — 로그인 완료 시점인 여기서 1회 반영 */}
      <ReferralApply myCode={summary?.social_code ?? null} />

      <h1 className="section-title mb-5">{dict.auth.account}</h1>

      <AccountProfileHeader
        userId={user.id}
        name={displayName}
        email={user.email ?? ''}
        seed={summary?.avatar_seed ?? null}
        photoUrl={summary?.avatar_url ?? null}
        gender={(profile as { gender?: string | null } | null)?.gender ?? null}
        traits={summary?.avatar_traits}
        code={summary?.social_code ?? null}
        heartsReceived={heartsReceived}
        heartsGiven={Number(summary?.hearts_given ?? 0)}
        referralCount={Number(summary?.referral_count ?? 0)}
        blocked={Boolean(summary?.blocked)}
        t={dict.social}
      />

      <div className="mt-6">
        <AccountTabs locale={locale} tabs={tabs} />
      </div>
      {/* 배지가 떠 있는 탭에 들어가면 "확인함"으로 기록 → 다음 렌더에서 숫자가 사라진다. */}
      <AccountTabSeen locale={locale} pendingTabs={pendingTabs} />

      <div className="mt-6">{children}</div>

      {/* 소셜 탭에서만 그려진다 — 읽음 처리·실시간 갱신도 이 컴포넌트가 맡는다. */}
      <NotifySettings
        locale={locale}
        userId={user.id}
        emailDigest={profile?.notify_email_digest ?? true}
        t={dict.social.notify}
      />

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-grey-100 pt-6">
        {isPartner && (
          <PartnerPortalLink baseUrl={partnerBaseUrl} label={dict.auth.partnerPortal} />
        )}
        <LogoutButton locale={locale} label={dict.auth.logout} />
        {/* 신청 전·심사 중·반려일 때만 — 승인된 오거나이저는 바로 위 포털 진입 버튼으로 간다. */}
        {!isWithdrawn && !isPartner && (
          <OrganizerEntryButton locale={locale} status={organizerStatus} t={dict.organizer} />
        )}
        <span className="flex-1" />
        <DeleteAccountButton
          locale={locale}
          label={dict.auth.deleteAccount}
          confirmText={isPartner ? dict.auth.deleteConfirmOrganizer : dict.auth.deleteConfirm}
          failedText={dict.auth.deleteFailed}
        />
      </div>
    </div>
  );
}
