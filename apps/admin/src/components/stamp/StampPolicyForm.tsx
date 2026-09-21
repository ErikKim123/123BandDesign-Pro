// Design Ref: 스탬프관리 — 정책 설정(app_settings 'stamps.policy'). 어드민 전용 RLS 라 브라우저에서 직접 읽고 쓴다.
// 이 값을 읽는 곳: award_stamps(적립 여부·개수) / redeem_stamp_card(카드 목표·보상 포인트) / 고객 스탬프 화면(stamps_policy RPC).
// 카드 완성 보상은 포인트다(0065) — 쿠폰 발급이던 시절의 reward_coupon_id·coupon_valid_days 는 저장 시 함께 사라진다.
'use client';
import { useEffect, useState } from 'react';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';

interface Policy {
  /** 스탬프 기능 자체를 쓰는지. 끄면 마이페이지에서 스탬프 탭이 사라지고 적립도 멈춘다. */
  visible: boolean;
  enabled: boolean;
  goal: number;
  reward_points: number;
  per_order: number;
  per_checkin: number;
  per_review: number;
  per_qna: number;
}

const DEFAULTS: Policy = {
  visible: true,
  enabled: true,
  goal: 10,
  reward_points: 300,
  per_order: 1,
  per_checkin: 1,
  per_review: 1,
  per_qna: 1,
};

export function StampPolicyForm() {
  const [policy, setPolicy] = useState<Policy>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: row } = await createClient()
        .from('app_settings')
        .select('value')
        .eq('key', 'stamps.policy')
        .maybeSingle();
      const v = (row?.value ?? {}) as Partial<Policy>;
      setPolicy({
        visible: v.visible ?? DEFAULTS.visible,
        enabled: v.enabled ?? DEFAULTS.enabled,
        goal: Number(v.goal ?? DEFAULTS.goal),
        reward_points: Number(v.reward_points ?? DEFAULTS.reward_points),
        per_order: Number(v.per_order ?? DEFAULTS.per_order),
        per_checkin: Number(v.per_checkin ?? DEFAULTS.per_checkin),
        per_review: Number(v.per_review ?? DEFAULTS.per_review),
        per_qna: Number(v.per_qna ?? DEFAULTS.per_qna),
      });
      setLoading(false);
    })();
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient()
      .from('app_settings')
      // 기능을 끄면 적립도 함께 멈춘다 — 안 보이는 카드에 도장이 쌓이면 안 된다.
      .upsert({
        key: 'stamps.policy',
        value: policy.visible ? policy : { ...policy, enabled: false },
        updated_at: new Date().toISOString(),
      });
    if (!error && !policy.visible) setPolicy((p) => ({ ...p, enabled: false }));
    setBusy(false);
    setMsg(error ? `${tr('저장 실패')}: ${error.message}` : tr('저장되었습니다.'));
  }

  const setNum =
    (k: keyof Policy, min = 0) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setPolicy((p) => ({ ...p, [k]: Math.max(min, Number(e.target.value) || 0) }));

  if (loading) return <p className="text-sm text-grey-500">{tr('불러오는 중…')}</p>;

  return (
    <div className="max-w-lg space-y-5">
      {/* 기능 사용 여부 — 정책 맨 위의 주 스위치 */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-grey-200 p-4">
        <div>
          <p className="text-sm font-semibold">{tr('스탬프 사용')}</p>
          <p className="mt-1 text-xs text-grey-500">
            {policy.visible
              ? tr('회원 마이페이지에 스탬프 탭이 보입니다.')
              : tr('사용 안 함 — 회원 마이페이지에서 스탬프 탭이 사라지고 새 도장도 찍히지 않습니다. 이미 모은 도장은 그대로 남습니다.')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={policy.visible}
          aria-label={tr('스탬프 사용')}
          onClick={() => setPolicy((p) => ({ ...p, visible: !p.visible }))}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            policy.visible ? 'bg-primary' : 'bg-grey-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              policy.visible ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <h2 className="text-lg uppercase tracking-tight">{tr('스탬프 정책')}</h2>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!policy.visible}
            checked={policy.visible && policy.enabled}
            onChange={(e) => setPolicy((p) => ({ ...p, enabled: e.target.checked }))}
          />
          <span className="font-medium">{tr('스탬프 적립 사용')}</span>
        </label>
        <p className="text-xs text-grey-500">
          {tr('끄면 새 도장이 찍히지 않습니다. 회원이 이미 모은 도장은 사라지지 않고 그대로 남습니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('카드 한 장의 도장 수')}</label>
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          value={policy.goal}
          onChange={setNum('goal', 1)}
        />
        <p className="text-xs text-grey-500">
          {tr('이 수만큼 모으면 카드가 완성되어 보상 포인트가 적립되고, 그 수만큼 도장이 소진되어 새 카드가 시작됩니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('카드 완성 보상 포인트')}</label>
        <input
          className="input"
          type="number"
          min={0}
          step={10}
          value={policy.reward_points}
          onChange={setNum('reward_points')}
        />
        <p className="text-xs text-grey-500">
          {tr('카드가 완성되면 이만큼의 포인트가 회원 계정에 바로 적립됩니다. 0 이면 보상이 나가지 않고 도장만 계속 쌓이며, 나중에 값을 넣으면 이미 채워진 카드도 그때 정산되어 지급됩니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('결제 완료 시 도장')}</label>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          value={policy.per_order}
          onChange={setNum('per_order')}
        />
        <p className="text-xs text-grey-500">
          {tr('결제가 확정되면 주문 1건당 지급됩니다. 0 이면 이 경로를 중단합니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('행사 참석(입장 확인) 시 도장')}</label>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          value={policy.per_checkin}
          onChange={setNum('per_checkin')}
        />
        <p className="text-xs text-grey-500">
          {tr('현장에서 QR 입장 확인을 하면 패스 1장당 지급됩니다. 0 이면 이 경로를 중단합니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('후기 작성 시 도장')}</label>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          value={policy.per_review}
          onChange={setNum('per_review')}
        />
        <p className="text-xs text-grey-500">
          {tr('상품 1개당 1회만 지급되며, 후기를 지웠다가 다시 써도 중복 지급되지 않습니다. 0 이면 이 경로를 중단합니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('문의(댓글) 작성 시 도장')}</label>
        <input
          className="input"
          type="number"
          min={0}
          step={1}
          value={policy.per_qna}
          onChange={setNum('per_qna')}
        />
        <p className="text-xs text-grey-500">
          {tr('후기와 마찬가지로 상품 1개당 1회만 지급됩니다. 0 이면 이 경로를 중단합니다.')}
        </p>
      </div>

      {/* 소급 적용을 하지 않는다는 점은 문의가 잦은 부분이라 화면에 명시한다. */}
      <div className="rounded-lg border border-grey-200 bg-grey-50 p-4">
        <p className="text-sm font-medium">{tr('과거 기록은 소급 적립되지 않습니다')}</p>
        <p className="mt-1 text-xs text-grey-600">
          {tr('스탬프 도입 이전의 주문·참석·후기에는 도장이 찍히지 않습니다. 시행 첫날 다수 회원의 카드가 한꺼번에 완성되어 보상이 쏟아지는 것을 막기 위한 것입니다. 개별 보상이 필요하면 회원 스탬프 탭에서 지급/차감으로 처리해 주세요.')}
        </p>
      </div>

      {msg && <p className="text-sm text-grey-700">{msg}</p>}

      <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
        {busy ? tr('저장 중…') : tr('저장')}
      </button>
    </div>
  );
}
