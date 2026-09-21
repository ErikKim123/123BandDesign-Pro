// Design Ref: 업적관리 — 수동 지급/회수.
//
// 현장 스캔(오프라인 업적)·SNS 태그·버그 제보처럼 시스템이 스스로 판정할 수 없는 업적은 운영진이 직접 준다.
// 자동 지급과 같은 규칙(보상 포인트 포함)으로 DB 함수 admin_grant_achievement 가 처리한다.
// 회수는 뱃지만 거둔다 — 이미 준 포인트는 '포인트 관리'에서 따로 차감한다.
//
// 흐름은 '회원 먼저'다: 운영자는 "이 사람에게 뭘 줄까"로 생각하지, "이 업적을 누구에게"로 생각하지 않는다.
//   ① 회원 검색 → ② 회원 고르면 그 사람의 뱃지판이 통째로 열린다(가진 것은 컬러 + 체크, 안 가진 것은 흑백)
//   → ③ 뱃지를 누르면 지급, 가진 뱃지를 누르면 회수(확인 후).
// 뱃지 그림을 그대로 쓰는 이유: 이름만 늘어놓은 셀렉트에서는 31개 중 무엇을 주는지 눈으로 고르기 어렵다.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Check, Gift, Loader2, Search, Undo2, X } from 'lucide-react';
import { tr, trI18n } from '@/i18n/tr';
import { FormDrawer } from '@/components/resource/FormDrawer';
import { CharacterAvatar } from '@/components/member/CharacterAvatar';
import { createClient } from '@/lib/supabase/client';
import type { AchievementRow } from '@/lib/resource/configs/achievements';
import { trackLabel } from '@/lib/resource/configs/achievements';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_traits: unknown;
}

interface Held {
  achievement_id: string;
  earned_at: string;
}

/** 지급 대상 업적 — 목록/그리드에 필요한 값만. */
type GrantAchievement = Pick<
  AchievementRow,
  'id' | 'code' | 'name_i18n' | 'conditions' | 'point_reward' | 'track'
> & { badge_image_url: string | null; product_id: string | null };

const isManual = (a: Pick<AchievementRow, 'conditions'>) =>
  Array.isArray(a.conditions) && a.conditions.some((c) => c?.type === 'manual');

const MEMBER_COLS = 'id, email, name, avatar_url, avatar_seed, avatar_traits';

export function ManualGrantButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <Gift size={14} /> {tr('수동 지급')}
      </button>
      <FormDrawer open={open} title={tr('업적 수동 지급')} size="wide" onClose={() => setOpen(false)}>
        {open && <ManualGrantPanel />}
      </FormDrawer>
    </>
  );
}

export function ManualGrantPanel({
  initialMemberId,
  hideSearch = false,
}: {
  initialMemberId?: string | null;
  /** 회원이 이미 정해진 자리(현장 데스크)에서는 검색·회원 카드 없이 뱃지판만 그린다. */
  hideSearch?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [achievements, setAchievements] = useState<GrantAchievement[]>([]);
  const [q, setQ] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [held, setHeld] = useState<Held[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [manualOnly, setManualOnly] = useState(false);

  // 활성 업적 — 노출 순서대로. 트랙별로 묶어 그린다.
  useEffect(() => {
    void supabase
      .from('achievements')
      .select('id, code, name_i18n, conditions, point_reward, track, badge_image_url, product_id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => setAchievements((data ?? []) as GrantAchievement[]));
  }, [supabase]);

  const loadHeld = useCallback(
    async (m: Member) => {
      const { data } = await supabase
        .from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', m.id);
      setHeld((data ?? []) as Held[]);
    },
    [supabase],
  );

  // 회원활동 등에서 회원을 지정해 열었을 때 — 그 회원을 바로 고른 상태로 시작한다.
  useEffect(() => {
    if (!initialMemberId) return;
    void supabase
      .from('profiles')
      .select(MEMBER_COLS)
      .eq('id', initialMemberId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const m = data as unknown as Member;
        setMember(m);
        void loadHeld(m);
      });
  }, [initialMemberId, supabase, loadHeld]);

  async function search() {
    const term = q.trim();
    if (term.length < 2) return;
    setSearching(true);
    setMsg(null);
    // PostgREST or() 문법에 들어가는 값 — 쉼표·괄호가 섞이면 식이 깨지므로 걸러낸다.
    const safe = term.replace(/[,()*]/g, ' ');
    const { data } = await supabase
      .from('profiles')
      .select(MEMBER_COLS)
      .eq('role', 'customer')
      .or(`email.ilike.%${safe}%,name.ilike.%${safe}%,social_code.ilike.%${safe}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    setMembers((data ?? []) as unknown as Member[]);
    setSearching(false);
  }

  async function pick(m: Member) {
    setMember(m);
    setMsg(null);
    await loadHeld(m);
  }

  async function grant(a: GrantAchievement) {
    if (!member || busyId) return;
    setBusyId(a.id);
    setMsg(null);
    const { data, error } = await supabase.rpc('admin_grant_achievement', {
      p_user_id: member.id,
      p_achievement_id: a.id,
    });
    setBusyId(null);
    const name = trI18n(a.name_i18n) || a.code;
    if (error) {
      setMsg({ tone: 'err', text: `${tr('지급하지 못했습니다')}: ${error.message}` });
      return;
    }
    setMsg(
      data
        ? {
            tone: 'ok',
            text: `${tr('지급했습니다')} — ${name}${a.point_reward > 0 ? ` (+${a.point_reward.toLocaleString()} P)` : ''}`,
          }
        : { tone: 'err', text: tr('이미 가진 업적입니다.') },
    );
    await loadHeld(member);
  }

  async function revoke(a: GrantAchievement) {
    if (!member || busyId) return;
    const name = trI18n(a.name_i18n) || a.code;
    if (!window.confirm(`${name} — ${tr('이 뱃지를 회수할까요? 이미 지급한 포인트는 되돌아가지 않습니다.')}`)) return;
    setBusyId(a.id);
    const { error } = await supabase.rpc('admin_revoke_achievement', {
      p_user_id: member.id,
      p_achievement_id: a.id,
    });
    setBusyId(null);
    setMsg(error ? { tone: 'err', text: error.message } : { tone: 'ok', text: `${tr('회수했습니다')} — ${name}` });
    await loadHeld(member);
  }

  const heldIds = new Set(held.map((h) => h.achievement_id));
  const shown = manualOnly ? achievements.filter(isManual) : achievements;
  // 트랙 순서는 업적의 노출 순서를 그대로 따른다(처음 나온 트랙이 먼저).
  const groups: { track: string | null; items: GrantAchievement[] }[] = [];
  for (const a of shown) {
    const g = groups.find((x) => x.track === (a.track ?? null));
    if (g) g.items.push(a);
    else groups.push({ track: a.track ?? null, items: [a] });
  }

  return (
    <div className="space-y-5">
      {/* ① 회원 찾기 */}
      {!hideSearch && (
      <div className="space-y-1.5">
        <label className="label-caps">{tr('1. 회원 찾기')}</label>
        <div className="flex gap-2">
          <input
            className="input"
            value={q}
            placeholder={tr('이메일 · 이름 · 추천 코드 (2자 이상)')}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
          />
          <button
            className="btn btn-secondary btn-sm shrink-0"
            onClick={() => void search()}
            disabled={searching || q.trim().length < 2}
          >
            <Search size={14} /> {tr('검색')}
          </button>
        </div>
        {members.length > 0 && (
          <ul className="divide-y divide-grey-100 overflow-hidden rounded-lg border border-grey-200">
            {members.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => void pick(m)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-grey-50',
                    member?.id === m.id && 'bg-grey-100',
                  )}
                >
                  <CharacterAvatar
                    seed={m.avatar_seed}
                    traits={m.avatar_traits}
                    photoUrl={m.avatar_url}
                    size={28}
                    className="shrink-0 rounded-full"
                  />
                  <span className="min-w-0 flex-1 truncate">{m.email ?? '—'}</span>
                  <span className="shrink-0 text-xs text-grey-500">{m.name ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!searching && q.trim().length >= 2 && members.length === 0 && (
          <p className="text-xs text-grey-500">{tr('검색 결과가 없습니다. 고객(구매 회원) 계정만 찾습니다.')}</p>
        )}
      </div>
      )}

      {/* ② 뱃지판 — 고른 회원 기준 */}
      {!member ? (
        <p className="rounded-lg border border-dashed border-grey-300 px-4 py-10 text-center text-sm text-grey-500">
          {tr('회원을 먼저 고르면 그 회원의 뱃지판이 열립니다.')}
        </p>
      ) : (
        <div className="space-y-4">
          {!hideSearch && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-grey-200 p-3">
            <CharacterAvatar
              seed={member.avatar_seed}
              traits={member.avatar_traits}
              photoUrl={member.avatar_url}
              size={44}
              className="shrink-0 rounded-full"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{member.name || member.email}</p>
              <p className="truncate text-xs text-grey-500">{member.email}</p>
            </div>
            <span className="shrink-0 rounded-pill bg-grey-100 px-2.5 py-1 text-xs text-grey-600">
              {tr('보유')} {held.length} / {achievements.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setMember(null);
                setHeld([]);
                setMsg(null);
              }}
              className="shrink-0 text-grey-400 hover:text-black"
              aria-label={tr('선택 해제')}
            >
              <X size={16} />
            </button>
          </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-grey-500">
              {tr('뱃지를 누르면 지급됩니다. 이미 가진 뱃지를 누르면 회수합니다(포인트는 그대로).')}
            </p>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-grey-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-black"
                checked={manualOnly}
                onChange={(e) => setManualOnly(e.target.checked)}
              />
              {tr('수동 지급용만 보기')}
            </label>
          </div>

          {msg && (
            <p
              className={cn(
                'rounded-md px-3 py-2 text-sm',
                msg.tone === 'ok' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
              )}
            >
              {msg.text}
            </p>
          )}

          {groups.map((g) => (
            <div key={g.track ?? 'none'}>
              <p className="label-caps mb-2">{trackLabel(g.track)}</p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {g.items.map((a) => {
                  const owned = heldIds.has(a.id);
                  const busy = busyId === a.id;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => (owned ? void revoke(a) : void grant(a))}
                        title={owned ? tr('회수') : tr('지급')}
                        className={cn(
                          'flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors',
                          owned
                            ? 'border-success/40 bg-success/5 hover:border-danger/50 hover:bg-danger/5'
                            : 'border-grey-200 hover:border-grey-400 hover:bg-grey-50',
                          busyId && !busy && 'opacity-50',
                        )}
                      >
                        <span className="relative flex h-14 w-14 items-center justify-center">
                          {a.badge_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.badge_image_url}
                              alt=""
                              className={cn('h-full w-full object-contain', !owned && 'opacity-45 grayscale')}
                            />
                          ) : (
                            <Award size={26} className="text-grey-300" />
                          )}
                          {/* 가진 뱃지는 체크, 처리 중이면 스피너 — 한 칸 안에서 상태가 보이게 */}
                          {busy ? (
                            <Loader2 size={16} className="absolute -right-1 -top-1 animate-spin text-grey-500" />
                          ) : owned ? (
                            <Check size={14} className="absolute -right-1 -top-1 rounded-full bg-success p-0.5 text-white" />
                          ) : null}
                        </span>
                        <span className="line-clamp-2 text-[11px] font-medium leading-tight">
                          {trI18n(a.name_i18n) || a.code}
                        </span>
                        <span className="flex flex-wrap items-center justify-center gap-1 text-[10px] text-grey-400">
                          {a.point_reward > 0 && <span>{a.point_reward.toLocaleString()} P</span>}
                          {isManual(a) && <span className="text-amber-700">{tr('수동')}</span>}
                          {a.product_id && <span className="text-primary">{tr('행사 전용')}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {held.length > 0 && (
            <div className="rounded-lg border border-grey-200 p-3">
              <p className="label-caps mb-1.5">{tr('보유 뱃지')}</p>
              <ul className="space-y-1">
                {held.map((h) => {
                  const a = achievements.find((x) => x.id === h.achievement_id);
                  return (
                    <li key={h.achievement_id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">
                        {a ? trI18n(a.name_i18n) || a.code : h.achievement_id}
                        <span className="ml-1.5 text-xs text-grey-400">{h.earned_at.slice(0, 10)}</span>
                      </span>
                      {a && (
                        <button
                          type="button"
                          onClick={() => void revoke(a)}
                          disabled={!!busyId}
                          className="flex shrink-0 items-center gap-1 text-xs text-grey-500 hover:text-danger"
                        >
                          <Undo2 size={12} /> {tr('회수')}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
