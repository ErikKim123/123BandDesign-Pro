// 오거나이저 계정 직접 생성 폼 (운영자) — /api/partners/create 호출.
// 로그인 계정(이메일/비번) + 입점정보(회사/국가/사업자번호/수수료/상태) 동시 생성.
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_OPTS = [
  { value: 'active', label: tr('활성(즉시 판매 가능)') },
  { value: 'pending', label: tr('대기(승인 전)') },
  { value: 'suspended', label: tr('정지') },
];

export function CreatePartnerForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    email: '',
    password: '',
    company_name: '',
    country: '',
    biz_no: '',
    commission_rate: '0.10',
    status: 'active',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/partners/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, commission_rate: Number(f.commission_rate) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tr('생성 실패'));
      qc.invalidateQueries({ queryKey: ['partners'] });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr('생성 실패'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="rounded-lg bg-grey-50 p-3 text-xs text-grey-500">
        로그인 계정과 입점정보를 함께 생성합니다. 생성된 오거나이저는 이 이메일/비밀번호로 오거나이저 사이트(:3002)에 로그인합니다.
      </p>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('로그인 이메일 *')}</label>
        <input type="email" required className="input" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="partner@example.com" />
      </div>
      <div className="space-y-1.5">
        <label className="label-caps">{tr('초기 비밀번호 * (8자 이상)')}</label>
        <input type="text" required className="input" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder="오거나이저에게 전달할 임시 비밀번호" />
      </div>
      <div className="space-y-1.5">
        <label className="label-caps">{tr('회사명 *')}</label>
        <input required className="input" value={f.company_name} onChange={(e) => set('company_name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="label-caps">{tr('국가')}</label>
          <input className="input" value={f.country} onChange={(e) => set('country', e.target.value)} placeholder="KR" />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{tr('사업자번호')}</label>
          <input className="input" value={f.biz_no} onChange={(e) => set('biz_no', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="label-caps">{tr('수수료율 (0~1) *')}</label>
          <input type="number" step="0.01" min="0" max="1" required className="input" value={f.commission_rate} onChange={(e) => set('commission_rate', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps">{tr('상태')}</label>
          <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
          {loading ? tr('생성 중…') : tr('오거나이저 생성')}
        </button>
        <button type="button" onClick={onDone} className="btn btn-secondary btn-sm">{tr('취소')}</button>
      </div>
    </form>
  );
}
