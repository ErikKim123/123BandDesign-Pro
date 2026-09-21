// Design Ref: 포인트관리 — 정책 설정(app_settings 'points.policy'). 어드민 전용 RLS 라 브라우저에서 직접 읽고 쓴다.
// signup_bonus 는 가입 트리거(handle_new_user)가, order_earn_percent 는 결제확정(earn_points_for_order)이 읽는다.
'use client';
import { useEffect, useState } from 'react';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';

interface Policy {
  signup_bonus: number;
  review_bonus: number;
  qna_bonus: number;
  order_earn_percent: number;
  coupon_valid_days: number;
}

const DEFAULTS: Policy = {
  signup_bonus: 100,
  review_bonus: 10,
  qna_bonus: 10,
  order_earn_percent: 0,
  coupon_valid_days: 30,
};

export function PointPolicyForm() {
  const [policy, setPolicy] = useState<Policy>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await createClient()
        .from('app_settings')
        .select('value')
        .eq('key', 'points.policy')
        .maybeSingle();
      const v = (data?.value ?? {}) as Partial<Policy>;
      setPolicy({
        signup_bonus: Number(v.signup_bonus ?? DEFAULTS.signup_bonus),
        review_bonus: Number(v.review_bonus ?? DEFAULTS.review_bonus),
        qna_bonus: Number(v.qna_bonus ?? DEFAULTS.qna_bonus),
        order_earn_percent: Number(v.order_earn_percent ?? DEFAULTS.order_earn_percent),
        coupon_valid_days: Number(v.coupon_valid_days ?? DEFAULTS.coupon_valid_days),
      });
      setLoading(false);
    })();
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient()
      .from('app_settings')
      .upsert({ key: 'points.policy', value: policy, updated_at: new Date().toISOString() });
    setBusy(false);
    setMsg(error ? `${tr('저장 실패')}: ${error.message}` : tr('저장되었습니다.'));
  }

  const set = (k: keyof Policy) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPolicy((p) => ({ ...p, [k]: Math.max(0, Number(e.target.value) || 0) }));

  if (loading) return <p className="text-sm text-grey-500">{tr('불러오는 중…')}</p>;

  return (
    <div className="max-w-lg space-y-5">
      <h2 className="text-lg uppercase tracking-tight">{tr('포인트 정책')}</h2>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('신규 가입 축하 포인트')}</label>
        <input className="input" type="number" min={0} step={1} value={policy.signup_bonus} onChange={set('signup_bonus')} />
        <p className="text-xs text-grey-500">{tr('회원가입이 완료되면 자동 지급됩니다. 0 이면 지급하지 않습니다.')}</p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('후기 작성 이벤트 포인트')}</label>
        <input className="input" type="number" min={0} step={1} value={policy.review_bonus} onChange={set('review_bonus')} />
        <p className="text-xs text-grey-500">
          {tr('고객이 상품후기를 남기면 자동 지급됩니다. 상품 1개당 1회만 지급되며, 후기를 지웠다가 다시 써도 중복 지급되지 않습니다. 0 이면 이벤트를 중단합니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('댓글(상품문의) 작성 이벤트 포인트')}</label>
        <input className="input" type="number" min={0} step={1} value={policy.qna_bonus} onChange={set('qna_bonus')} />
        <p className="text-xs text-grey-500">
          {tr('고객이 상품문의(댓글)를 남기면 자동 지급됩니다. 후기와 마찬가지로 상품 1개당 1회만 지급됩니다. 0 이면 이벤트를 중단합니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('구매 적립률 (%)')}</label>
        <input
          className="input"
          type="number"
          min={0}
          step={0.1}
          value={policy.order_earn_percent}
          onChange={set('order_earn_percent')}
        />
        <p className="text-xs text-grey-500">
          {tr('결제가 확정될 때 결제금액의 이 비율만큼 적립합니다. 기준액은 KRW=원, 그 외 통화=달러 환산 금액입니다. 0 이면 적립하지 않습니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('교환 쿠폰 기본 유효일수')}</label>
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          value={policy.coupon_valid_days}
          onChange={set('coupon_valid_days')}
        />
        <p className="text-xs text-grey-500">
          {tr('포인트로 교환한 쿠폰의 사용 기한입니다. 쿠폰별로 유효일수를 지정하면 그 값이 우선합니다.')}
        </p>
      </div>

      {/* 외부 SNS 이벤트 안내 — 인스타 등 외부 채널 댓글은 시스템이 검증할 수 없어 수동 지급으로 처리한다. */}
      <div className="rounded-lg border border-grey-200 bg-grey-50 p-4">
        <p className="text-sm font-medium">{tr('인스타그램 등 외부 SNS 이벤트')}</p>
        <p className="mt-1 text-xs text-grey-600">
          {tr('외부 SNS 댓글은 사이트가 작성자를 확인할 수 없어 자동 지급 대상이 아닙니다. 회원 포인트 탭에서 해당 회원을 찾아 지급/차감으로 지급해 주세요. 메모에 남긴 사유는 고객의 포인트 내역에도 그대로 표시됩니다.')}
        </p>
      </div>

      {msg && <p className="text-sm text-grey-700">{msg}</p>}

      <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
        {busy ? tr('저장 중…') : tr('저장')}
      </button>
    </div>
  );
}
