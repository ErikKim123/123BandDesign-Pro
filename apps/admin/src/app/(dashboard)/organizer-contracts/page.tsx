// 오거나이저 계약 — 신청서를 읽고 승인/반려하는 화면.
//
// 오거나이저회원 관리(/partners)는 '이미 입점한 곳'의 정보를 고치는 자리다. 여기는 그 앞 단계 —
// 회원이 주최자 약관에 동의하고 낸 신청서를 심사한다. 승인하면 그 계정이 오거나이저 포털로
// 들어갈 수 있게 되므로(0116 is_partner), 약관 동의 기록을 함께 보여 준다.
'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, RotateCcw, Store, X } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { OrganizerAccess } from '@/components/partner/OrganizerAccess';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Row {
  user_id: string;
  company_name: string | null;
  country: string | null;
  biz_no: string | null;
  contact: string | null;
  intro: string | null;
  status: string;
  applied_at: string | null;
  terms_version: string | null;
  terms_agreed_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  profiles?: { email: string | null; name: string | null } | null;
}

const TABS: { key: string; label: string }[] = [
  { key: 'pending', label: '심사 대기' },
  { key: 'active', label: '승인됨' },
  { key: 'rejected', label: '반려' },
  { key: 'all', label: '전체' },
];

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function OrganizerContractsPage() {
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['organizer_contracts', tab],
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from('partners')
        .select(
          // partners 에서 profiles 로 가는 길이 둘이다(신청자 user_id · 승인자 approved_by).
          // 그냥 profiles(...) 로 적으면 PostgREST 가 어느 쪽인지 몰라 300 을 돌려준다.
          'user_id, company_name, country, biz_no, contact, intro, status, applied_at, terms_version, terms_agreed_at, approved_at, rejected_at, reject_reason, profiles!partners_user_id_fkey(email, name)',
        )
        .order('applied_at', { ascending: false, nullsFirst: false });
      if (tab !== 'all') q = q.eq('status', tab);
      // 심사 목록은 신청서를 낸 행만 본다 — 예전에 가입으로 만들어진 행은 심사할 게 없다.
      // '승인됨' 탭만 예외다: 거기서 대회 한도와 공유를 정하므로, 신청 절차가 생기기 전부터
      // 오거나이저였던 사람도 빠짐없이 나와야 한다.
      if (tab !== 'active') q = q.not('applied_at', 'is', null);
      const { data, error: err } = await q;
      if (err) throw err;
      return (data ?? []) as unknown as Row[];
    },
  });

  const review = useMutation({
    mutationFn: async (v: { userId: string; approve: boolean; reason?: string }) => {
      const { error: err } = await supabase.rpc('admin_review_organizer', {
        p_user_id: v.userId,
        p_approve: v.approve,
        p_reason: v.reason ?? null,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      setReasonFor(null);
      setReason('');
      setError('');
      qc.invalidateQueries({ queryKey: ['organizer_contracts'] });
      qc.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (e: Error) => setError(tr(e.message) || tr('처리하지 못했습니다.')),
  });

  const rows = list.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl uppercase tracking-tight">{tr('오거나이저 계약')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-grey-600">
            {tr('회원이 주최자 약관에 동의하고 낸 신청서입니다. 승인하면 그 계정이 오거나이저 포털로 들어갈 수 있습니다.')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setTab(x.key)}
            className={cn(
              'rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors',
              tab === x.key ? 'bg-black text-white' : 'bg-grey-100 text-grey-600 hover:text-black',
            )}
          >
            {tr(x.label)}
          </button>
        ))}
      </div>

      {error && <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}

      {list.isLoading ? (
        <p className="py-14 text-center text-sm text-grey-500">{tr('불러오는 중…')}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-grey-300 py-14 text-center text-sm text-grey-500">
          <Store size={28} className="mx-auto mb-2 text-grey-300" />
          {tr('해당하는 신청이 없습니다.')}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.user_id} className="rounded-lg border border-grey-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{r.company_name || '—'}</p>
                  <p className="text-xs text-grey-500">
                    {r.profiles?.name ? `${r.profiles.name} · ` : ''}
                    {r.profiles?.email ?? '—'}
                  </p>
                </div>
                <StatusPill status={r.status} />
              </div>

              <dl className="mt-3 grid grid-cols-[minmax(5.5rem,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="label-caps pt-0.5 !text-[10px]">{tr('국가')}</dt>
                <dd className="text-grey-700">{r.country || '—'}</dd>
                <dt className="label-caps pt-0.5 !text-[10px]">{tr('연락처')}</dt>
                <dd className="text-grey-700">{r.contact || '—'}</dd>
                <dt className="label-caps pt-0.5 !text-[10px]">{tr('사업자번호')}</dt>
                <dd className="text-grey-700">{r.biz_no || '—'}</dd>
                {r.intro && (
                  <>
                    <dt className="label-caps pt-0.5 !text-[10px]">{tr('소개')}</dt>
                    <dd className="whitespace-pre-line text-grey-700">{r.intro}</dd>
                  </>
                )}
                <dt className="label-caps pt-0.5 !text-[10px]">{tr('신청일')}</dt>
                <dd className="text-grey-700">{fmt(r.applied_at)}</dd>
                {/* 계약 기록 — 어느 판에 언제 동의했는지. 분쟁이 생기면 이 두 줄이 근거가 된다. */}
                <dt className="label-caps pt-0.5 !text-[10px]">{tr('약관 동의')}</dt>
                <dd className="text-grey-700">
                  {r.terms_version ? `${tr('판')} ${r.terms_version} · ${fmt(r.terms_agreed_at)}` : '—'}
                </dd>
                {r.status === 'active' && (
                  <>
                    <dt className="label-caps pt-0.5 !text-[10px]">{tr('승인일')}</dt>
                    <dd className="text-grey-700">{fmt(r.approved_at)}</dd>
                  </>
                )}
                {r.status === 'rejected' && (
                  <>
                    <dt className="label-caps pt-0.5 !text-[10px]">{tr('반려 사유')}</dt>
                    <dd className="whitespace-pre-line text-grey-700">{r.reject_reason || '—'}</dd>
                  </>
                )}
              </dl>

              {reasonFor === r.user_id ? (
                <div className="mt-3 space-y-2 rounded-md bg-grey-50 p-3">
                  <textarea
                    className="input min-h-20"
                    placeholder={tr('반려 사유 — 신청자에게 그대로 보입니다.')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setReasonFor(null);
                        setReason('');
                      }}
                    >
                      {tr('취소')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ userId: r.user_id, approve: false, reason })}
                    >
                      {tr('반려하기')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {r.status !== 'active' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={review.isPending}
                      onClick={() => {
                        if (!window.confirm(`${r.company_name ?? ''} — ${tr('이 신청을 승인할까요? 승인하면 오거나이저 포털을 쓸 수 있게 됩니다.')}`)) return;
                        review.mutate({ userId: r.user_id, approve: true });
                      }}
                    >
                      <Check size={14} /> {r.status === 'rejected' ? tr('다시 승인') : tr('승인')}
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={review.isPending}
                      onClick={() => {
                        setReasonFor(r.user_id);
                        setReason(r.reject_reason ?? '');
                      }}
                    >
                      <X size={14} /> {tr('반려')}
                    </button>
                  )}
                </div>
              )}

              {/* 승인된 곳만 — 심사 중인 신청서에 한도와 공유를 정해 둘 자리는 없다. */}
              {r.status === 'active' && (
                <OrganizerAccess userId={r.user_id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending: { label: '심사 대기', cls: 'bg-amber-100 text-amber-800', icon: <Clock size={12} /> },
    active: { label: '승인됨', cls: 'bg-success/10 text-success', icon: <Check size={12} /> },
    rejected: { label: '반려', cls: 'bg-danger/10 text-danger', icon: <X size={12} /> },
    suspended: { label: '정지', cls: 'bg-grey-100 text-grey-500', icon: <RotateCcw size={12} /> },
  };
  const v = map[status] ?? { label: status, cls: 'bg-grey-100 text-grey-500', icon: null };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 text-[11px] font-medium',
        v.cls,
      )}
    >
      {v.icon}
      {tr(v.label)}
    </span>
  );
}
