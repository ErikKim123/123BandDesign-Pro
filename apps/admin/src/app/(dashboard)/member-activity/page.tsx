// Design Ref: 회원활동 — 일반회원의 아바타와 활동을 한 곳에서 본다.
// 탭 3개:
//   ① 아바타 갤러리 — 회원 카드(아바타 + 활동 요약). 카드를 누르면 상세 드로어.
//   ② 활동 피드   — 포인트/스탬프/하트/주문/후기/문의/게시글/업적/쿠폰/추천/가입 통합 타임라인.
//   ③ 아바타 통계 — 어떤 얼굴 조합이 실제로 쓰이는지 분포.
// 회원관리(계정 수정·차단·삭제)와 역할이 다르다 — 여기는 '보는' 화면이고 조치는 각 관리 화면에서 한다.
'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { cn } from '@/lib/utils';
import { MemberAvatarGrid } from '@/components/member-activity/MemberAvatarGrid';
import { MemberActivityDrawer } from '@/components/member-activity/MemberActivityDrawer';
import { AvatarStatsPanel } from '@/components/member-activity/AvatarStatsPanel';
import { ActivityFeed } from '@/components/member-activity/ActivityFeed';
import { KindFilter } from '@/components/member-activity/KindFilter';
import { Pager } from '@/components/member-activity/Pager';
import { useActivityFeed, type ActivityKind } from '@/lib/queries/member-activity';

const TABS = [
  { key: 'gallery', label: '아바타 갤러리' },
  { key: 'feed', label: '활동 피드' },
  { key: 'avatars', label: '아바타 통계' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const FEED_PAGE_SIZE = 40;

const RANGE_OPTS = [
  { value: 7, label: '최근 7일' },
  { value: 30, label: '최근 30일' },
  { value: 90, label: '최근 90일' },
  { value: 0, label: '전체 기간' },
];

function FeedTab({ onMemberClick }: { onMemberClick: (userId: string) => void }) {
  const [kinds, setKinds] = useState<ActivityKind[]>([]);
  const [term, setTerm] = useState('');
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);

  // 조건이 바뀌면 1페이지로 — 5페이지를 보다 필터를 좁히면 빈 화면이 나온다.
  function reset<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  const { data, isLoading } = useActivityFeed({
    kinds,
    term,
    days,
    page,
    pageSize: FEED_PAGE_SIZE,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            className="input pl-9"
            placeholder={tr('회원·내용 검색')}
            value={term}
            onChange={(e) => reset(setTerm)(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={days}
          onChange={(e) => reset(setDays)(Number(e.target.value))}
        >
          {RANGE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {tr(o.label)}
            </option>
          ))}
        </select>
      </div>

      <KindFilter value={kinds} onChange={reset(setKinds)} />

      <ActivityFeed rows={data?.rows ?? []} loading={isLoading} onMemberClick={onMemberClick} />

      <Pager page={page} pageSize={FEED_PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}

// useSearchParams 는 Suspense 경계가 필요하다(Next CSR bailout).
export default function MemberActivityPage() {
  return (
    <Suspense fallback={null}>
      <MemberActivityView />
    </Suspense>
  );
}

function MemberActivityView() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('gallery');
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);

  // 회원관리에서 "활동 보기"로 넘어오면 ?member=<id> 가 붙는다 — 그 회원의 상세를 바로 연다.
  // 드로어를 닫으면 주소에서도 지워 뒤로가기·새로고침 때 다시 열리지 않게 한다.
  const memberParam = params.get('member');
  useEffect(() => {
    if (memberParam) setOpenMemberId(memberParam);
  }, [memberParam]);
  function closeDrawer() {
    setOpenMemberId(null);
    if (memberParam) router.replace('/member-activity', { scroll: false });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl uppercase tracking-tight">{tr('회원활동')}</h1>

      <p className="text-sm text-grey-600">
        {tr('일반회원(오거나이저·관리자 제외)의 캐릭터 아바타와 활동을 모아 봅니다. 조회 전용이며, 회원 정보 수정·차단은 회원관리에서 합니다.')}
      </p>

      <div className="flex flex-wrap gap-1 border-b border-grey-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
              tab === t.key
                ? 'border-black font-medium text-black'
                : 'border-transparent text-grey-500 hover:text-grey-700',
            )}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>

      {tab === 'gallery' && <MemberAvatarGrid onSelect={setOpenMemberId} />}
      {tab === 'feed' && <FeedTab onMemberClick={setOpenMemberId} />}
      {tab === 'avatars' && <AvatarStatsPanel />}

      <MemberActivityDrawer memberId={openMemberId} onClose={closeDrawer} />
    </div>
  );
}
