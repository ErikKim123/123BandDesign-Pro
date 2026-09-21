// 내 정보 (오거나이저) — 본인 입점정보(partners) 조회/수정. 수수료율·상태는 운영자 설정(읽기전용).
// RLS: partners_own (user_id = auth.uid()) 로 본인 행만 조회/upsert.
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePartner } from '@/lib/partner/context';
import { StatusBadge } from '@/components/form/StatusBadge';
import { useT } from '@/i18n/useT';

interface PartnerForm {
  company_name: string;
  phone: string;
  country: string;
  biz_no: string;
  // 정산정보 — 고정 구조(은행명/계좌번호/예금주). 저장은 settlement_info jsonb.
  bank: string;
  account: string;
  holder: string;
}

export default function ProfilePage() {
  const t = useT();
  const { userId, email } = usePartner();
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>({ company_name: '', phone: '', country: '', biz_no: '', bank: '', account: '', holder: '' });
  const [commissionRate, setCommissionRate] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    // 파트너 부가정보(partners) + 전화번호(profiles.phone) 를 함께 로드.
    Promise.all([
      supabase
        .from('partners')
        .select('company_name, country, biz_no, settlement_info, commission_rate, status')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('profiles').select('phone').eq('id', userId).maybeSingle(),
    ])
      .then(([{ data }, { data: prof }]) => {
        if (!alive) return;
        const si = (data?.settlement_info ?? {}) as Record<string, unknown>;
        setForm({
          company_name: data?.company_name ?? '',
          phone: prof?.phone ?? '',
          country: data?.country ?? '',
          biz_no: data?.biz_no ?? '',
          bank: typeof si.bank === 'string' ? si.bank : '',
          account: typeof si.account === 'string' ? si.account : '',
          holder: typeof si.holder === 'string' ? si.holder : '',
        });
        if (data) {
          setCommissionRate(Number(data.commission_rate ?? 0));
          setStatus(data.status ?? null);
        }
      })
      .then(undefined, () => {})
      .then(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  function set<K extends keyof PartnerForm>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
    setDone(false);
  }

  // 비밀번호 변경 (로그인 상태에서 즉시 재설정)
  async function changePassword() {
    setPwMsg(null);
    setPwErr(null);
    if (newPassword.length < 8) {
      setPwErr(t.account.pwTooShort);
      return;
    }
    setPwSaving(true);
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwErr(error.message || t.account.pwError);
      return;
    }
    setNewPassword('');
    setPwMsg(t.account.pwChanged);
  }

  // 비밀번호 재설정 메일 발송
  async function sendReset() {
    setPwMsg(null);
    setPwErr(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
    });
    if (error) {
      setPwErr(error.message || t.account.resetError);
      return;
    }
    setPwMsg(t.account.resetSent);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (!form.company_name.trim()) {
      setError(t.profile.errCompanyName);
      return;
    }
    // 고정 구조 → settlement_info jsonb. 모두 비면 null.
    const bank = form.bank.trim();
    const account = form.account.trim();
    const holder = form.holder.trim();
    const settlement = bank || account || holder ? { bank, account, holder } : null;
    setSaving(true);
    const supabase = createClient();
    // upsert: 본인 partners 행 (없으면 생성). 수수료율/상태는 건드리지 않음(운영자 권한).
    // 전화번호는 profiles.phone 에 저장(계정 프로필). RLS: profiles_self.
    const [{ error: upErr }, { error: profErr }] = await Promise.all([
      supabase.from('partners').upsert(
        {
          user_id: userId,
          company_name: form.company_name.trim(),
          country: form.country.trim() || null,
          biz_no: form.biz_no.trim() || null,
          settlement_info: settlement,
        },
        { onConflict: 'user_id' },
      ),
      supabase.from('profiles').update({ phone: form.phone.trim() || null }).eq('id', userId),
    ]);
    setSaving(false);
    if (upErr || profErr) {
      setError((upErr ?? profErr)!.message);
      return;
    }
    setDone(true);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl uppercase tracking-tight">{t.profile.title}</h1>
        <p className="text-grey-500">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl uppercase tracking-tight">{t.profile.title}</h1>

      {/* 계정 — 아이디(이메일) + 비밀번호 변경/재설정 */}
      <div className="space-y-3 rounded-lg border border-grey-200 p-4">
        <p className="label-caps text-grey-400">{t.account.title}</p>
        <div className="space-y-1.5">
          <label className="label-caps">{t.account.id}</label>
          <input className="input bg-grey-50" value={email} readOnly disabled />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.account.newPassword}</label>
          <input
            type="password"
            className="input"
            value={newPassword}
            placeholder={t.account.newPasswordPh}
            autoComplete="new-password"
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        {pwErr && <p className="text-sm text-danger">{pwErr}</p>}
        {pwMsg && <p className="text-sm text-success">{pwMsg}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pwSaving} onClick={changePassword} className="btn btn-primary btn-sm">
            {pwSaving ? t.account.changing : t.account.changePassword}
          </button>
          <button type="button" onClick={sendReset} className="btn btn-secondary btn-sm">
            {t.account.resetEmail}
          </button>
        </div>
      </div>

      {/* 운영자 설정 (읽기전용) */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-grey-200 p-4">
        <div>
          <p className="label-caps text-grey-400">{t.profile.partnerStatusLabel}</p>
          <div className="mt-1.5">
            {status ? <StatusBadge status={status} /> : <span className="text-grey-500">{t.partnerStatus.unregistered}</span>}
            {status && (
              <span className="ml-2 text-sm text-grey-500">
                {(t.partnerStatus as Record<string, string>)[status] ?? status}
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="label-caps text-grey-400">{t.profile.commissionRateLabel}</p>
          <p className="mt-1.5 font-display text-xl">
            {commissionRate != null ? `${(commissionRate * 100).toFixed(1)}%` : '—'}
          </p>
        </div>
        <p className="text-xs text-grey-400">{t.profile.adminControlled}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        {done && <p className="text-sm text-success">{t.profile.saved}</p>}

        <div className="space-y-1.5">
          <label className="label-caps">{t.profile.companyName} *</label>
          <input className="input" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.profile.phone}</label>
          <input className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder={t.profile.phonePh} />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.profile.country}</label>
          <input className="input" value={form.country} onChange={(e) => set('country', e.target.value)} placeholder={t.profile.countryPlaceholder} />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{t.profile.bizNo}</label>
          <input className="input" value={form.biz_no} onChange={(e) => set('biz_no', e.target.value)} />
        </div>
        <div className="space-y-2 rounded-lg border border-grey-200 p-4">
          <p className="label-caps text-grey-400">{t.profile.settlementInfo}</p>
          <div className="space-y-1.5">
            <label className="label-caps">{t.profile.bank}</label>
            <input className="input" value={form.bank} onChange={(e) => set('bank', e.target.value)} placeholder={t.profile.bankPh} />
          </div>
          <div className="space-y-1.5">
            <label className="label-caps">{t.profile.account}</label>
            <input className="input" value={form.account} onChange={(e) => set('account', e.target.value)} placeholder={t.profile.accountPh} />
          </div>
          <div className="space-y-1.5">
            <label className="label-caps">{t.profile.holder}</label>
            <input className="input" value={form.holder} onChange={(e) => set('holder', e.target.value)} placeholder={t.profile.holderPh} />
          </div>
          <p className="text-[11px] text-grey-400">{t.profile.settlementHint}</p>
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
          {saving ? t.common.saving : t.common.save}
        </button>
      </form>
    </div>
  );
}
