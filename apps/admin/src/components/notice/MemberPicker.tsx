// 알림 받는 사람 고르기 — 이메일/이름으로 찾아서 한 명씩 담는다.
//
// 회원목록에서 체크해 보내는 길(선택 발송)이 이미 있는데도 여기 검색을 두는 이유:
// "이 사람에게 보내야지"가 먼저 정해진 경우에는 목록을 뒤지는 것보다 이름을 치는 게 빠르다.
// 담은 사람은 칩으로 남아 보내기 전에 누구에게 가는지 눈으로 한 번 더 확인된다.
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';

export interface PickedMember {
  id: string;
  email: string | null;
  name: string | null;
}

/** 칩·검색결과에 쓰는 표시 이름 — 이름이 없으면 이메일, 그것도 없으면 id 앞자리. */
export function memberLabel(m: PickedMember): string {
  return (m.name ?? '').trim() || (m.email ?? '').trim() || m.id.slice(0, 8);
}

export function MemberPicker({
  picked,
  onChange,
}: {
  picked: PickedMember[];
  onChange: (next: PickedMember[]) => void;
}) {
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<PickedMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked]);
  // 입력이 멈춘 뒤에만 찾는다 — 한 글자마다 왕복하면 목록이 깜빡인다.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = term.trim();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 2) {
      setRows([]);
      setSearched(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        // 알림을 받는 건 일반회원이다 — 운영자·오거나이저는 검색에서 뺀다.
        const { data } = await createClient()
          .from('profiles')
          .select('id, email, name')
          .eq('role', 'customer')
          .or(`email.ilike.%${q}%,name.ilike.%${q}%`)
          .order('created_at', { ascending: false })
          .limit(8);
        setRows((data ?? []) as PickedMember[]);
        setSearched(true);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [term]);

  function add(m: PickedMember) {
    if (pickedIds.has(m.id)) return;
    onChange([...picked, m]);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
        <input
          className="input pl-9"
          value={term}
          placeholder={tr('이메일/이름으로 회원 검색 (2글자 이상)')}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {/* 검색 결과 — 누르면 아래 목록에 담긴다. 이미 담은 사람은 '담김'으로 표시. */}
      {term.trim().length >= 2 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-grey-200">
          {busy ? (
            <p className="px-4 py-6 text-center text-sm text-grey-500">{tr('찾는 중…')}</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-grey-500">
              {searched ? tr('검색 결과가 없습니다.') : tr('찾는 중…')}
            </p>
          ) : (
            <ul>
              {rows.map((m) => {
                const already = pickedIds.has(m.id);
                return (
                  <li key={m.id} className="border-b border-grey-100 last:border-b-0">
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => add(m)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-grey-50 disabled:cursor-default disabled:opacity-50"
                    >
                      <UserPlus size={15} className="shrink-0 text-grey-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{memberLabel(m)}</span>
                        {m.name && m.email && (
                          <span className="block truncate text-xs text-grey-500">{m.email}</span>
                        )}
                      </span>
                      {already && <span className="text-xs text-grey-500">{tr('담김')}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 담은 사람 — 여기 있는 사람에게만 나간다. */}
      {picked.length === 0 ? (
        <p className="text-xs text-grey-500">{tr('받는 사람을 한 명 이상 담아 주세요.')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {picked.map((m) => (
            <span
              key={m.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-pill border border-grey-300 bg-white py-1 pl-3 pr-1.5 text-xs"
              title={m.email ?? undefined}
            >
              <span className="truncate">{memberLabel(m)}</span>
              <button
                type="button"
                aria-label={tr('빼기')}
                onClick={() => onChange(picked.filter((x) => x.id !== m.id))}
                className="rounded-full p-0.5 text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
              >
                <X size={13} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-1 text-xs text-grey-500 underline underline-offset-4 hover:text-ink"
          >
            {tr('모두 빼기')}
          </button>
        </div>
      )}
    </div>
  );
}
