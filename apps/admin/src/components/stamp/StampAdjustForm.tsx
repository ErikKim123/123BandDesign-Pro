// Design Ref: 스탬프관리 — 회원 도장 수동 지급/차감. admin_adjust_stamps RPC(관리자 검증 내장) 경유.
// 진행도 컬럼은 DB 트리거로 직접 수정이 막혀 있어 반드시 이 경로로만 변경된다.
// 지급으로 카드가 차면 RPC 안에서 보상 포인트 적립까지 같이 일어난다.
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { stampUnit } from '@/components/stamp/StampDelta';
import type { StampBalanceRow } from '@/lib/resource/configs/stamp-balances';

// 원문(한국어)을 키로 두고 표시 직전에 번역한다 — 모듈 상수에서 번역하면 로케일 전환이 반영되지 않는다.
const ERR: Record<string, string> = {
  insufficient_stamps: '보유 도장보다 많이 차감할 수 없습니다.',
  forbidden: '관리자 권한이 필요합니다.',
  invalid_delta: '0 이 아닌 값을 입력해 주세요.',
  user_not_found: '회원을 찾을 수 없습니다.',
};

export function StampAdjustForm({
  member,
  onDone,
}: {
  member: StampBalanceRow;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'grant' | 'deduct'>('grant');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0;

  async function submit() {
    if (!valid) {
      setError(tr('1 이상의 정수를 입력해 주세요.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await createClient().rpc('admin_adjust_stamps', {
        p_user_id: member.id,
        p_delta: mode === 'grant' ? n : -n,
        p_memo: memo.trim() || null,
      });
      if (rpcError) {
        const key = Object.keys(ERR).find((k) => rpcError.message.includes(k));
        setError((key && tr(ERR[key])) || rpcError.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ['stamp-balances'] });
      qc.invalidateQueries({ queryKey: ['stamp-ledger'] });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-grey-200 bg-grey-50 p-4">
        <p className="text-sm font-medium">{member.name || member.email}</p>
        <p className="text-xs text-grey-500">{member.email}</p>
        <p className="mt-2 text-sm">
          {tr('현재 보유')}{' '}
          <span className="font-semibold tabular-nums">
            {stampUnit(Number(member.stamp_count ?? 0))}
          </span>
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('처리 구분')}</label>
        <div className="flex gap-2">
          {(['grant', 'deduct'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`btn btn-sm ${mode === m ? 'btn-primary' : 'btn-secondary'}`}
            >
              {m === 'grant' ? tr('지급 (+)') : tr('차감 (−)')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('도장 수')}</label>
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          placeholder={tr('예: 1')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-xs text-grey-500">
          {tr('지급으로 카드가 채워지면 보상 포인트가 그 자리에서 바로 적립됩니다.')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps">{tr('메모 (회원에게도 노출)')}</label>
        <input
          className="input"
          placeholder={tr('예: 오프라인 행사 참여 보상')}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={busy}>
          {tr('취소')}
        </button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !valid}>
          {busy ? tr('처리 중…') : mode === 'grant' ? tr('지급') : tr('차감')}
        </button>
      </div>
    </div>
  );
}
