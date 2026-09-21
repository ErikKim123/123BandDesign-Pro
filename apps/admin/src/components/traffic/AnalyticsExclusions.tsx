// 분석 제외 계정 — 운영자가 테스트로 돌린 계정을 방문자수·퍼널·주간리포트 집계에서 뺀다(0104).
//
// 기록을 지우는 게 아니라 집계에서 거른다. 그래서 빼고 넣는 것이 언제든 되돌려진다.
// 제외 계정이 로그인한 적 있는 기기(방문자 쿠키)는 로그인 전 기록까지 같이 빠진다 — 그 사람 것이므로.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EyeOff, Search, X } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';

interface Member {
  id: string;
  email: string | null;
  name: string | null;
  role?: string | null;
}

interface Excluded extends Member {
  note: string | null;
  created_at: string;
}

export function AnalyticsExclusions() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [rows, setRows] = useState<Excluded[]>([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('analytics_exclusions')
      .select('user_id, note, created_at')
      .order('created_at', { ascending: false });
    if (error) return setErr(error.message);
    const ids = (data ?? []).map((r) => r.user_id as string);
    // 제외 표는 auth.users 를 가리켜 프로필을 바로 붙일 수 없다 — 따로 가져와 합친다.
    const { data: profiles } = ids.length
      ? await supabase.from('profiles').select('id, email, name, role').in('id', ids)
      : { data: [] as Member[] };
    const byId = new Map(((profiles ?? []) as Member[]).map((p) => [p.id, p]));
    setRows(
      (data ?? []).map((r) => ({
        id: r.user_id as string,
        email: byId.get(r.user_id as string)?.email ?? null,
        name: byId.get(r.user_id as string)?.name ?? null,
        role: byId.get(r.user_id as string)?.role ?? null,
        note: (r.note as string | null) ?? null,
        created_at: r.created_at as string,
      })),
    );
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function search() {
    const term = q.trim();
    if (term.length < 2) return;
    setBusy(true);
    // PostgREST or() 식에 들어가는 값 — 쉼표·괄호가 섞이면 식이 깨진다.
    const safe = term.replace(/[,()*]/g, ' ');
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .or(`email.ilike.%${safe}%,name.ilike.%${safe}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    const have = new Set(rows.map((r) => r.id));
    setFound(((data ?? []) as Member[]).filter((m) => !have.has(m.id)));
    setBusy(false);
  }

  async function add(m: Member) {
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('analytics_exclusions').insert({ user_id: m.id });
    setBusy(false);
    if (error) return setErr(error.message);
    setFound((f) => f.filter((x) => x.id !== m.id));
    await load();
    router.refresh(); // 서버가 그린 집계(방문자수·퍼널)가 새 기준으로 다시 나오게
  }

  async function remove(id: string) {
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('analytics_exclusions').delete().eq('user_id', id);
    setBusy(false);
    if (error) return setErr(error.message);
    await load();
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-grey-200 p-4">
      <div className="flex items-center gap-2">
        <EyeOff size={16} className="text-grey-400" />
        <h2 className="text-lg uppercase tracking-tight">{tr('분석 제외 계정')}</h2>
      </div>
      <p className="mt-1 text-xs text-grey-500">
        {tr(
          '테스트용 계정을 넣으면 그 계정의 방문·주문이 방문자수·퍼널분석·주간리포트에서 빠집니다. 기록을 지우는 것이 아니라 집계에서만 거르므로 언제든 되돌릴 수 있습니다. 그 계정으로 로그인한 적 있는 기기의 로그인 전 방문도 함께 빠집니다.',
        )}
      </p>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            className="input pl-8 text-sm"
            placeholder={tr('이메일 또는 이름으로 회원 찾기')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
          />
        </div>
        <button className="btn btn-secondary btn-sm" disabled={busy || q.trim().length < 2} onClick={() => void search()}>
          {tr('찾기')}
        </button>
      </div>
      {found.length > 0 && (
        <ul className="mt-2 divide-y divide-grey-100 rounded-md border border-grey-200">
          {found.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium">{m.name || m.email}</span>
                {m.name && m.email && <span className="ml-2 text-xs text-grey-400">{m.email}</span>}
                {m.role && m.role !== 'customer' && (
                  <span className="ml-2 rounded-pill bg-grey-100 px-1.5 py-0.5 text-[10px] text-grey-500">{m.role}</span>
                )}
              </span>
              <button className="btn btn-primary btn-sm shrink-0" disabled={busy} onClick={() => void add(m)}>
                {tr('제외')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {err && <p className="mt-2 text-xs text-danger">{err}</p>}

      <ul className="mt-3 space-y-1.5">
        {rows.length === 0 && <li className="text-xs text-grey-400">{tr('제외된 계정이 없습니다.')}</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-md bg-grey-50 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-medium">{r.name || r.email || r.id.slice(0, 8)}</span>
              {r.name && r.email && <span className="ml-2 text-xs text-grey-400">{r.email}</span>}
            </span>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 text-xs text-grey-500 hover:text-danger"
              disabled={busy}
              onClick={() => void remove(r.id)}
              title={tr('다시 포함')}
            >
              <X size={13} /> {tr('다시 포함')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
