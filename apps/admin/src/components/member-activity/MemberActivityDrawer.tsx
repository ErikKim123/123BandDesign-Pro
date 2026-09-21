// 회원활동 §1-상세 — 회원 한 명의 아바타(크게) + 아바타 구성 + 활동 요약 + 개인 타임라인.
// 갤러리 카드나 피드의 회원 줄을 누르면 열린다. 조회 전용 — 여기서 값을 바꾸지 않는다
// (차단/포인트 조정 등은 각 관리 화면의 책임이고, 여기서 겹쳐 두면 사고가 난다).
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Coins, Stamp, Heart, Send, ShoppingCart, Star, HelpCircle, MessageSquare,
  Award, Ticket, UserPlus, ExternalLink, type LucideIcon,
} from 'lucide-react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { CharacterAvatar } from '@/components/member/CharacterAvatar';
import { LoginStatusInfo } from '@/components/member/LoginStatus';
import { avatarSpec, parseTraits } from '@/lib/avatar';
import { fmtDateTime } from '@/lib/resource/configs/point-ledger';
import {
  useActivityFeed,
  useActivityMember,
  totalActivity,
  type ActivityKind,
  type ActivityMemberRow,
} from '@/lib/queries/member-activity';
import { ActivityFeed } from './ActivityFeed';
import { KindFilter } from './KindFilter';
import { Pager } from './Pager';
import { fmtAgo, countryLabel } from './format';
import { COLOR_TRAITS, COLOR_TRAIT_KEYS, SHAPE_TRAITS, SHAPE_TRAIT_KEYS, shapeTraitLabel } from './avatar-traits';

const PAGE_SIZE = 30;

function StatCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-grey-200 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-tight text-grey-400">
        <Icon size={12} /> {tr(label)}
      </span>
      <p className="mt-1 truncate font-display text-lg tabular-nums">{value}</p>
    </div>
  );
}

/** 아바타가 어떤 조합으로 만들어졌는지 — 회원이 직접 고른 항목엔 '선택' 표시를 단다. */
function AvatarBreakdown({ member }: { member: ActivityMemberRow }) {
  const chosen = parseTraits(member.avatar_traits);
  const spec = avatarSpec(member.avatar_seed, chosen);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {SHAPE_TRAIT_KEYS.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 rounded-pill border border-grey-200 px-2.5 py-1 text-[11px]"
          >
            <span className="text-grey-400">{tr(SHAPE_TRAITS[k].label)}</span>
            <span>{tr(shapeTraitLabel(k, spec))}</span>
            {chosen[k] !== undefined && (
              <span className="rounded-pill bg-black px-1.5 text-[9px] text-white">{tr('선택')}</span>
            )}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {COLOR_TRAIT_KEYS.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-grey-500">
            <span
              className="size-4 rounded-full border border-grey-200"
              style={{ backgroundColor: spec[k] }}
            />
            {tr(COLOR_TRAITS[k].label)}
            {chosen[k] !== undefined && <span className="text-grey-400">·{tr('선택')}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 갤러리 카드와 피드의 회원 줄이 둘 다 여는 창이라, 넘겨받는 건 id 하나뿐이고
 *  요약 행은 여기서 직접 읽는다(피드 쪽은 회원 요약을 갖고 있지 않다). */
export function MemberActivityDrawer({
  memberId,
  onClose,
}: {
  memberId: string | null;
  onClose: () => void;
}) {
  const [kinds, setKinds] = useState<ActivityKind[]>([]);
  const [page, setPage] = useState(1);

  // 다른 회원으로 갈아탈 때 이전 회원의 필터/페이지가 따라붙지 않게 초기화.
  useEffect(() => {
    setKinds([]);
    setPage(1);
  }, [memberId]);

  const { data: member, isLoading: memberLoading } = useActivityMember(memberId);
  const { data, isLoading } = useActivityFeed(
    { kinds, term: '', userId: memberId ?? undefined, days: 0, page, pageSize: PAGE_SIZE },
    Boolean(memberId),
  );

  if (!memberId) return null;
  if (!member) {
    return (
      <FormDrawer open title={tr('회원 활동')} size="wide" onClose={onClose}>
        <p className="py-10 text-center text-sm text-grey-500">
          {memberLoading ? tr('불러오는 중…') : tr('회원 정보를 찾을 수 없습니다.')}
        </p>
      </FormDrawer>
    );
  }

  const country = countryLabel(member.country);
  const stats = [
    { icon: Coins, label: '보유 포인트', value: `${member.point_balance.toLocaleString()} P` },
    { icon: Stamp, label: '스탬프', value: String(member.stamp_count) },
    { icon: Heart, label: '받은 하트', value: String(member.hearts_received) },
    { icon: Send, label: '보낸 하트', value: String(member.hearts_given) },
    { icon: UserPlus, label: '친구 추천', value: String(member.referral_count) },
    { icon: ShoppingCart, label: '주문', value: String(member.order_count) },
    { icon: Star, label: '후기', value: String(member.review_count) },
    { icon: HelpCircle, label: '상품문의', value: String(member.qna_count) },
    { icon: MessageSquare, label: '게시글', value: String(member.board_count) },
    { icon: Award, label: '업적', value: String(member.achievement_count) },
    { icon: Ticket, label: '쿠폰', value: String(member.coupon_count) },
  ];

  return (
    <FormDrawer open title={tr('회원 활동')} size="wide" onClose={onClose}>
      <div className="space-y-6">
        {/* 신원 + 아바타 */}
        <div className="flex flex-wrap items-start gap-5">
          <CharacterAvatar
            seed={member.avatar_seed}
            traits={member.avatar_traits}
            photoUrl={member.avatar_url}
            size={112}
            className="shrink-0 rounded-full"
            label={member.name ?? member.email ?? 'member'}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-lg font-medium">{member.name || member.email || '—'}</p>
            <p className="truncate text-sm text-grey-500">{member.email ?? '—'}</p>
            <p className="text-xs text-grey-400">
              <span className="font-mono">{member.social_code ?? '—'}</span>
              {country && ` · ${country}`}
              {` · ${tr('가입')} ${fmtDateTime(member.created_at)}`}
            </p>
            <p className="text-xs text-grey-400">
              {tr('마지막 활동')} {fmtAgo(member.last_activity_at)} ·{' '}
              {fmt(tr('활동 {n}건'), { n: totalActivity(member).toLocaleString() })}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {member.social_blocked_at && (
                <span className="rounded-pill bg-grey-800 px-2.5 py-0.5 text-[11px] text-white">
                  {tr('소셜 정지')} {fmtDateTime(member.social_blocked_at)}
                </span>
              )}
              {/* 조치는 각 관리 화면에서 — 여기서는 바로 갈 수 있는 길만 열어둔다. */}
              <Link href={`/members?edit=${member.id}`} className="inline-flex items-center gap-1 text-xs text-grey-500 underline hover:text-black">
                {tr('회원관리')} <ExternalLink size={11} />
              </Link>
              <Link href="/points" className="inline-flex items-center gap-1 text-xs text-grey-500 underline hover:text-black">
                {tr('포인트관리')} <ExternalLink size={11} />
              </Link>
              <Link href={`/achievements?member=${member.id}`} className="inline-flex items-center gap-1 text-xs text-grey-500 underline hover:text-black">
                {tr('업적 지급')} <ExternalLink size={11} />
              </Link>
              <Link href="/social" className="inline-flex items-center gap-1 text-xs text-grey-500 underline hover:text-black">
                {tr('소셜관리')} <ExternalLink size={11} />
              </Link>
            </div>
          </div>
        </div>

        {/* 아바타 구성 */}
        <section className="space-y-2">
          <h3 className="label-caps">{tr('아바타 구성')}</h3>
          <p className="text-xs text-grey-500">
            {member.avatar_customized
              ? tr('회원이 편집기에서 직접 고른 항목에 "선택" 표시가 붙습니다. 나머지는 가입 시 시드에서 자동으로 정해진 값입니다.')
              : tr('아직 편집기에서 아무것도 고르지 않은 회원입니다 — 전부 가입 시 시드에서 자동으로 정해진 기본 얼굴입니다.')}
          </p>
          <AvatarBreakdown member={member} />
        </section>

        {/* 활동 요약 */}
        <section className="space-y-2">
          <h3 className="label-caps">{tr('활동 요약')}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {stats.map((s) => (
              <StatCell key={s.label} icon={s.icon} label={s.label} value={s.value} />
            ))}
          </div>
        </section>

        {/* 로그인 상태 — 회원관리 드로어와 같은 표기 */}
        <section className="space-y-2">
          <h3 className="label-caps">{tr('최근 로그인')}</h3>
          <LoginStatusInfo userId={member.id} />
        </section>

        {/* 개인 타임라인 */}
        <section className="space-y-3">
          <h3 className="label-caps">{tr('활동 내역')}</h3>
          <KindFilter
            value={kinds}
            onChange={(next) => {
              setKinds(next);
              setPage(1);
            }}
          />
          <ActivityFeed rows={data?.rows ?? []} loading={isLoading} showMember={false} />
          <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
        </section>
      </div>
    </FormDrawer>
  );
}
