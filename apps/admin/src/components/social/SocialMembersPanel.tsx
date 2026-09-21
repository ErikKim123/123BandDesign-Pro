// Design Ref: 소셜관리 — 회원별 소셜 상태(코드 확인 / 소셜 정지·해제).
// 정지는 admin_set_social_block RPC 로만 건다. profiles 를 직접 UPDATE 해도
// 0043 의 profiles_social_guard 트리거가 어드민이 아닌 변경을 되돌린다.
'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, RotateCcw, Search } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';
import { fmtDateTime } from '@/lib/resource/configs/point-ledger';

interface MemberRow {
  id: string;
  name: string | null;
  email: string | null;
  social_code: string | null;
  social_blocked_at: string | null;
  created_at: string;
}

export function SocialMembersPanel() {
  const qc = useQueryClient();
  const [term, setTerm] = useState('');
  const [blockedOnly, setBlockedOnly] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['social-members', term, blockedOnly],
    queryFn: async () => {
      let q = createClient()
        .from('profiles')
        .select('id, name, email, social_code, social_blocked_at, created_at')
        .eq('role', 'customer')
        .order('created_at', { ascending: false })
        .limit(50);
      if (blockedOnly) q = q.not('social_blocked_at', 'is', null);
      if (term.trim()) {
        const like = `%${term.trim()}%`;
        q = q.or(`name.ilike.${like},email.ilike.${like},social_code.ilike.${like}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const { data, error } = await createClient().rpc('admin_set_social_block', {
        p_user_id: id,
        p_blocked: blocked,
      });
      if (error) throw error;
      const res = (data ?? null) as { ok?: boolean; error?: string } | null;
      if (!res?.ok) throw new Error(res?.error ?? 'failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-members'] });
      qc.invalidateQueries({ queryKey: ['social-stats'] });
    },
    onError: (err) => {
      window.alert(`${tr('처리에 실패했습니다')}: ${err instanceof Error ? tr(err.message) : ''}`);
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-grey-600">
        {tr('소셜 정지된 회원은 하트를 보낼 수도, 받을 수도 없습니다. 부적절한 사용 신고가 들어왔을 때 사용하세요.')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
          <input
            className="input pl-9"
            placeholder={tr('회원 이메일/이름/코드 검색')}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-grey-600">
          <input
            type="checkbox"
            checked={blockedOnly}
            onChange={(e) => setBlockedOnly(e.target.checked)}
          />
          {tr('정지된 회원만')}
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-grey-500">{tr('불러오는 중…')}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-grey-200 p-6 text-center text-sm text-grey-500">
          {tr('조건에 맞는 회원이 없습니다.')}
        </p>
      ) : (
        <ul className="divide-y divide-grey-100 border-y border-grey-100">
          {rows.map((m) => {
            const blocked = Boolean(m.social_blocked_at);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name || m.email || '—'}
                    {blocked && (
                      <span className="ml-2 rounded-pill bg-grey-100 px-2 py-0.5 text-[11px] text-grey-600">
                        {tr('소셜 정지')}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-grey-500">
                    {m.email} · <span className="font-mono">{m.social_code ?? '—'}</span>
                    {blocked && ` · ${tr('정지')} ${fmtDateTime(m.social_blocked_at)}`}
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm shrink-0"
                  disabled={toggle.isPending}
                  onClick={() => {
                    if (
                      !blocked &&
                      !window.confirm(tr('이 회원의 소셜 기능(하트 주고받기)을 정지할까요?'))
                    )
                      return;
                    toggle.mutate({ id: m.id, blocked: !blocked });
                  }}
                >
                  {blocked ? <RotateCcw size={14} /> : <Ban size={14} />}
                  {blocked ? tr('정지 해제') : tr('소셜 정지')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
