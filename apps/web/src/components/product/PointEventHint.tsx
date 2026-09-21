// Design Ref: 후기/댓글 작성 포인트 이벤트 안내 배지.
// 지급액은 어드민 정책값(app_settings 'points.policy')이라 하드코딩하지 않고 points_policy() RPC 로 읽는다.
// 이벤트가 꺼져 있으면(0) 아무것도 렌더하지 않는다.
'use client';
import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function PointEventHint({ kind, label }: { kind: 'review' | 'qna'; label: string }) {
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    let alive = true;
    void createClient()
      .rpc('points_policy')
      .then(({ data }) => {
        if (!alive) return;
        const v = (data ?? {}) as Record<string, number | undefined>;
        setAmount(Number((kind === 'review' ? v.review_bonus : v.qna_bonus) ?? 0));
      });
    return () => {
      alive = false;
    };
  }, [kind]);

  if (amount <= 0) return null;
  return (
    <p className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      <Coins size={13} />
      {label.replace('{n}', amount.toLocaleString())}
    </p>
  );
}
