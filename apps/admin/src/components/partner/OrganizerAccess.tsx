// 오거나이저가 대시보드에서 볼 수 있는 대회 — 한도와 공유를 여기서 정한다.
//
// 대시보드(J&J·BATTLE·DIV)는 들어온 사람이 운영진이면 전부, 오거나이저면 '자기 대회'만 보여 준다.
// 그 '자기 대회'가 이 화면에서 정해진다:
//   주인   — 그 사람이 직접 만든 대회(대시보드가 만들 때 자동으로 기록한다). 한도에 센다.
//   공유   — 운영진이 미리 만들어 둔 대회를 열어 준 것. 직접 만들 줄 모르는 주최자를 위한 길이다.
//            한도에 세지 않는다 — 우리가 준 것이지 그 사람이 쓴 몫이 아니다.
//
// 사용 여부와 대회 수는 종류(J&J·BATTLE·DIV)마다 따로 정한다(0121). 처음에는 세 대시보드를
// 합쳐 한 칸으로 뒀는데, J&J 만 여는 주최자에게 BATTLE·DIV 까지 열어 둘 이유가 없었고
// 'J&J 2개 + BATTLE 1개' 같은 계약을 합산 한 칸으로는 적을 수가 없었다.
//
// 체크를 끄면 그 종류는 오거나이저에게 보이지 않는다 — 오거나이저 로그인 화면의 바로가기도
// 이 값을 본다. 공유는 체크와 무관하게 줄 수 있지만, 꺼 두면 들어가지 못하므로 같이 켜야 한다.
'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';
import { DASH_SOURCES, dashClient, type DashSource } from '@/lib/queries/jnj-import';
import { cn } from '@/lib/utils';

interface AccessRow {
  dash: DashSource;
  contest_id: string;
  role: 'owner' | 'shared';
}

const DASH_LABEL: Record<DashSource, string> = { jnj: 'J&J', battle: 'BATTLE', div: 'DIV' };

/** 종류별 사용 여부와 대회 수 · 디비전 수 — partner_dashboards 한 줄. */
interface DashSetting {
  dash: DashSource;
  enabled: boolean;
  maxContests: number;
  /** 대회 하나당 만들 수 있는 디비전 수. */
  maxDivisions: number;
}

/** 한 대시보드의 대회 목록. 고르는 칸을 열었을 때만 읽는다. */
function useDashContests(source: DashSource | '', enabled: boolean) {
  return useQuery({
    queryKey: ['dash_contests', source],
    enabled: enabled && !!source,
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await dashClient(source as DashSource)
        .from('contests')
        .select('id, name')
        .order('id', { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

export function OrganizerAccess({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();
  const [dash, setDash] = useState<DashSource | ''>('');
  const [contestId, setContestId] = useState('');
  const [error, setError] = useState('');
  // 입력 중인 대회 수 — 저장 전까지는 화면에만 있다. 키를 누를 때마다 저장하면
  // '1' 을 지우고 '2' 를 치는 사이에 0 이 저장된다.
  const [draft, setDraft] = useState<Record<string, string>>({});

  const settings = useQuery({
    queryKey: ['organizer_dashboards', userId],
    queryFn: async (): Promise<DashSetting[]> => {
      const { data, error: err } = await supabase
        .from('partner_dashboards')
        .select('dash, enabled, max_contests, max_divisions')
        .eq('user_id', userId);
      if (err) throw err;
      const got = new Map(
        (
          (data ?? []) as unknown as {
            dash: DashSource;
            enabled: boolean;
            max_contests: number;
            max_divisions: number;
          }[]
        ).map((r) => [r.dash, r]),
      );
      // 줄이 없는 종류도 자리를 만들어 둔다 — 세 줄이 늘 같은 자리에 있어야 눈이 익는다.
      return DASH_SOURCES.map((d) => ({
        dash: d.value,
        enabled: got.get(d.value)?.enabled ?? false,
        maxContests: got.get(d.value)?.max_contests ?? 1,
        maxDivisions: got.get(d.value)?.max_divisions ?? 2,
      }));
    },
  });

  const access = useQuery({
    queryKey: ['organizer_access', userId],
    queryFn: async (): Promise<AccessRow[]> => {
      const { data, error: err } = await supabase
        .from('dashboard_contest_access')
        .select('dash, contest_id, role')
        .eq('user_id', userId)
        .order('dash');
      if (err) throw err;
      return (data ?? []) as unknown as AccessRow[];
    },
  });

  const contests = useDashContests(dash, !!dash);
  const rows = access.data ?? [];
  const used = rows.filter((r) => r.role === 'owner').length;
  // 이미 가진 대회는 다시 고를 수 없게 — 같은 걸 두 번 넣으면 기본키가 막는다.
  const taken = new Set(rows.filter((r) => r.dash === dash).map((r) => r.contest_id));

  // 사용 여부·대회 수 — 줄이 없을 수도 있어 upsert 로 쓴다.
  const saveSetting = useMutation({
    mutationFn: async (v: { dash: DashSource; enabled: boolean; maxContests: number; maxDivisions: number }) => {
      const { error: err } = await supabase.from('partner_dashboards').upsert(
        {
          user_id: userId,
          dash: v.dash,
          enabled: v.enabled,
          max_contests: Math.max(0, Math.min(99, v.maxContests)),
          max_divisions: Math.max(0, Math.min(99, v.maxDivisions)),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,dash' },
      );
      if (err) throw err;
    },
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['organizer_dashboards', userId] });
    },
    onError: (e: Error) => setError(tr(e.message) || tr('처리하지 못했습니다.')),
  });

  const share = useMutation({
    mutationFn: async (v: { dash: DashSource; contestId: string }) => {
      const { data: me } = await supabase.auth.getUser();
      const { error: err } = await supabase.from('dashboard_contest_access').insert({
        dash: v.dash,
        contest_id: v.contestId,
        user_id: userId,
        role: 'shared',
        granted_by: me.user?.id ?? null,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      setContestId('');
      setError('');
      qc.invalidateQueries({ queryKey: ['organizer_access', userId] });
    },
    onError: (e: Error) => setError(tr(e.message) || tr('처리하지 못했습니다.')),
  });

  const unshare = useMutation({
    mutationFn: async (v: AccessRow) => {
      const { error: err } = await supabase
        .from('dashboard_contest_access')
        .delete()
        .eq('user_id', userId)
        .eq('dash', v.dash)
        .eq('contest_id', v.contest_id);
      if (err) throw err;
    },
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['organizer_access', userId] });
    },
    onError: (e: Error) => setError(tr(e.message) || tr('처리하지 못했습니다.')),
  });

  const busy = saveSetting.isPending || share.isPending || unshare.isPending;
  const dashRows = settings.data ?? [];
  // 종류별로 '직접 만든 대회' 가 몇 개인지 — 한도 옆에 붙어야 남은 자리가 읽힌다.
  const ownedBy = (d: DashSource) =>
    rows.filter((r) => r.dash === d && r.role === 'owner').length;

  return (
    <div className="mt-4 space-y-4 rounded-md bg-grey-50 p-3.5">
      {/* 종류별 사용 여부와 대회 수 — 체크를 끄면 그 종류는 오거나이저에게 보이지 않는다. */}
      <div className="space-y-1.5">
        <span className="label-caps !text-[10px]">{tr('쓸 수 있는 대시보드')}</span>
        {settings.isLoading ? (
          <p className="text-sm text-grey-500">{tr('불러오는 중…')}</p>
        ) : (
          <ul className="space-y-1">
            {dashRows.map((r) => {
              const key = `${userId}:${r.dash}`;
              const divKey = `${key}:div`;
              const shown = draft[key] ?? String(r.maxContests);
              const shownDiv = draft[divKey] ?? String(r.maxDivisions);
              const owned = ownedBy(r.dash);
              // 저장 버튼은 둘 중 하나라도 건드렸을 때 나온다.
              const dirty =
                (shown !== String(r.maxContests) && shown !== '') ||
                (shownDiv !== String(r.maxDivisions) && shownDiv !== '');
              return (
                <li
                  key={r.dash}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded bg-white px-3 py-2 text-sm"
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-black"
                      checked={r.enabled}
                      disabled={busy}
                      onChange={(e) =>
                        saveSetting.mutate({
                          dash: r.dash,
                          enabled: e.target.checked,
                          maxContests: Number(shown) || 0,
                          maxDivisions: Number(shownDiv) || 0,
                        })
                      }
                    />
                    <span className="w-16 font-medium">{DASH_LABEL[r.dash]}</span>
                  </label>

                  {/* 꺼 둔 종류의 대회 수는 만질 수 없다 — 못 들어가는 곳의 한도는 뜻이 없다. */}
                  <span className="flex items-center gap-1.5 text-grey-600">
                    <input
                      type="number"
                      min={0}
                      max={99}
                      className="input h-7 w-16 py-0.5 text-center disabled:opacity-40"
                      value={shown}
                      disabled={busy || !r.enabled}
                      onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
                    />
                    <span className="text-xs">{tr('개까지')}</span>
                  </span>

                  {/* 디비전은 '대회 하나당' 이다 — 합계로 두면 대회 두 개를 가진 사람이
                      첫 대회에 다 써 버려 두 번째 대회를 열 수 없다. */}
                  <span className="flex items-center gap-1.5 text-grey-600">
                    <span className="text-xs">{tr('대회당 디비전')}</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      className="input h-7 w-16 py-0.5 text-center disabled:opacity-40"
                      value={shownDiv}
                      disabled={busy || !r.enabled}
                      onChange={(e) => setDraft((p) => ({ ...p, [divKey]: e.target.value }))}
                    />
                    <span className="text-xs">{tr('개까지')}</span>
                  </span>

                  <span className="text-xs text-grey-500">
                    {tr('직접 만든 대회 N개').replace('N', String(owned))}
                  </span>

                  {dirty && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => {
                        saveSetting.mutate({
                          dash: r.dash,
                          enabled: r.enabled,
                          maxContests: Number(shown) || 0,
                          maxDivisions: Number(shownDiv) || 0,
                        });
                        setDraft((p) => {
                          const n = { ...p };
                          delete n[key];
                          delete n[divKey];
                          return n;
                        });
                      }}
                    >
                      {tr('저장')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 볼 수 있는 대회 */}
      <div className="space-y-1.5">
        <span className="label-caps !text-[10px]">{tr('볼 수 있는 대회')}</span>
        {access.isLoading ? (
          <p className="text-sm text-grey-500">{tr('불러오는 중…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-grey-500">{tr('아직 없습니다. 아래에서 대회를 공유해 주세요.')}</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => (
              <li
                key={`${r.dash}:${r.contest_id}`}
                className="flex items-center justify-between gap-2 rounded bg-white px-2.5 py-1.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-[10px] font-medium text-grey-600">
                    {DASH_LABEL[r.dash]}
                  </span>
                  <span className="truncate font-mono text-xs text-ink">{r.contest_id}</span>
                  <span
                    className={cn(
                      'shrink-0 text-[11px]',
                      r.role === 'owner' ? 'text-grey-500' : 'text-success',
                    )}
                  >
                    {r.role === 'owner' ? tr('직접 만듦') : tr('공유됨')}
                  </span>
                </span>
                {/* 직접 만든 대회는 여기서 뺏지 않는다 — 자기 자료를 못 보게 되는 건 다른 문제다. */}
                {r.role === 'shared' && (
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-grey-400 transition-colors hover:text-danger"
                    title={tr('공유 해제')}
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`${r.contest_id} — ${tr('이 대회 공유를 해제할까요?')}`)) return;
                      unshare.mutate(r);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 공유 추가 */}
      <div className="flex flex-wrap items-center gap-2">
        <Link2 size={14} className="text-grey-400" />
        <select
          className="input h-8 w-28 py-1 text-sm"
          value={dash}
          onChange={(e) => {
            setDash(e.target.value as DashSource | '');
            setContestId('');
          }}
        >
          <option value="">{tr('대시보드')}</option>
          {DASH_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {DASH_LABEL[s.value]}
            </option>
          ))}
        </select>
        <select
          className="input h-8 min-w-48 flex-1 py-1 text-sm"
          value={contestId}
          disabled={!dash || contests.isLoading}
          onChange={(e) => setContestId(e.target.value)}
        >
          <option value="">{contests.isLoading ? tr('불러오는 중…') : tr('대회 선택')}</option>
          {(contests.data ?? [])
            .filter((c) => !taken.has(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} · {c.name}
              </option>
            ))}
        </select>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || !dash || !contestId}
          onClick={() => share.mutate({ dash: dash as DashSource, contestId })}
        >
          <Plus size={14} /> {tr('공유')}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
