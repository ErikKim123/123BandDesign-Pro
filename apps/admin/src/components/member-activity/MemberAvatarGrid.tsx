// 회원활동 §1 — 아바타 갤러리. 일반회원을 카드로 늘어놓고 아바타 + 활동 요약을 보여준다.
// 카드 한 장이 "이 회원이 어떤 얼굴이고, 무엇을 얼마나 했는지" 를 담는다.
// 데이터는 admin_member_activity_v 한 번 조회로 끝난다(0066).
'use client';
import { useState } from 'react';
import { Search, Coins, Stamp, Heart, ShoppingCart, Star, Award, UserPlus } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { CharacterAvatar } from '@/components/member/CharacterAvatar';
import {
  useActivityMembers,
  totalActivity,
  type ActivityMemberRow,
  type MemberSort,
} from '@/lib/queries/member-activity';
import { fmtAgo, countryLabel } from './format';
import { Pager } from './Pager';

const PAGE_SIZE = 24;

const SORT_OPTS: { value: MemberSort; label: string }[] = [
  { value: 'recent_activity', label: '최근 활동순' },
  { value: 'joined', label: '최근 가입순' },
  { value: 'point', label: '포인트 많은순' },
  { value: 'hearts', label: '하트 받은순' },
  { value: 'orders', label: '주문 많은순' },
];

/** 카드 아래 지표 4종 — 0 이어도 자리를 지킨다(카드 높이가 들쭉날쭉하면 갤러리가 지저분해진다). */
function Metrics({ m }: { m: ActivityMemberRow }) {
  const items = [
    { icon: Coins, value: `${m.point_balance.toLocaleString()}P`, title: '보유 포인트' },
    { icon: Stamp, value: String(m.stamp_count), title: '모으는 중인 스탬프' },
    { icon: Heart, value: String(m.hearts_received), title: '받은 하트' },
    { icon: ShoppingCart, value: String(m.order_count), title: '주문' },
  ];
  return (
    <div className="mt-3 grid grid-cols-4 gap-1 border-t border-grey-100 pt-3">
      {items.map(({ icon: Icon, value, title }) => (
        <span
          key={title}
          title={tr(title)}
          className="flex flex-col items-center gap-1 text-xs text-grey-600"
        >
          <Icon size={13} className="text-grey-400" />
          <span className="tabular-nums">{value}</span>
        </span>
      ))}
    </div>
  );
}

export function MemberAvatarGrid({ onSelect }: { onSelect: (memberId: string) => void }) {
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState<MemberSort>('recent_activity');
  const [customizedOnly, setCustomizedOnly] = useState(false);
  const [page, setPage] = useState(1);

  // 검색어·정렬·필터가 바뀌면 1페이지로 — 3페이지를 보다 검색하면 빈 화면이 나온다.
  function reset<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  const { data, isLoading } = useActivityMembers({
    term,
    sort,
    page,
    pageSize: PAGE_SIZE,
    customizedOnly,
  });
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            className="input pl-9"
            placeholder={tr('회원 이메일/이름/코드 검색')}
            value={term}
            onChange={(e) => reset(setTerm)(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={sort}
          onChange={(e) => reset(setSort)(e.target.value as MemberSort)}
        >
          {SORT_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {tr(o.label)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-grey-600">
          <input
            type="checkbox"
            checked={customizedOnly}
            onChange={(e) => reset(setCustomizedOnly)(e.target.checked)}
          />
          {tr('직접 꾸민 아바타만')}
        </label>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-grey-500">{tr('불러오는 중…')}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-grey-200 py-10 text-center text-sm text-grey-500">
          {tr('조건에 맞는 회원이 없습니다.')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {rows.map((m) => {
            const blocked = Boolean(m.social_blocked_at);
            const country = countryLabel(m.country);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className="flex w-full flex-col rounded-lg border border-grey-200 p-4 text-left transition-colors duration-200 hover:border-grey-400 hover:bg-grey-50"
                >
                  <div className="flex items-start gap-3">
                    <CharacterAvatar
                      seed={m.avatar_seed}
                      traits={m.avatar_traits}
                      photoUrl={m.avatar_url}
                      size={56}
                      className="shrink-0 rounded-full"
                      label={m.name ?? m.email ?? 'member'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name || m.email || '—'}</p>
                      <p className="truncate text-xs text-grey-500">{m.email ?? '—'}</p>
                      <p className="mt-1 truncate font-mono text-[11px] text-grey-400">
                        {m.social_code ?? '—'}
                        {country && <span className="ml-1.5 font-sans">{country}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {blocked && (
                      <span className="rounded-pill bg-grey-800 px-2 py-0.5 text-[10px] text-white">
                        {tr('소셜 정지')}
                      </span>
                    )}
                    {!m.avatar_customized && (
                      <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-[10px] text-grey-500">
                        {tr('기본 얼굴')}
                      </span>
                    )}
                    {m.achievement_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-grey-100 px-2 py-0.5 text-[10px] text-grey-600">
                        <Award size={10} /> {m.achievement_count}
                      </span>
                    )}
                    {m.referral_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-grey-100 px-2 py-0.5 text-[10px] text-grey-600">
                        <UserPlus size={10} /> {m.referral_count}
                      </span>
                    )}
                    {m.review_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-grey-100 px-2 py-0.5 text-[10px] text-grey-600">
                        <Star size={10} /> {m.review_count}
                      </span>
                    )}
                  </div>

                  <Metrics m={m} />

                  <p className="mt-3 flex items-center justify-between text-[11px] text-grey-400">
                    <span>{fmt(tr('활동 {n}건'), { n: totalActivity(m).toLocaleString() })}</span>
                    <span>{fmtAgo(m.last_activity_at)}</span>
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
