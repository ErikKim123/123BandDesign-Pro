// 사용(입장완료)한 주문을 주문내역에서 삭제(=숨김) 처리. 판매자/정산 기록은 보존되고
// 구매자 뷰에서만 사라진다(hide_order RPC → orders.buyer_hidden_at).
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function OrderDeleteButton({
  orderId,
  label,
  confirmText,
  failedText,
  deletingLabel,
}: {
  orderId: string;
  label: string;
  confirmText: string;
  failedText: string;
  /** 처리 중 문구. 없으면 기본 라벨을 그대로 쓴다(문구 미번역 환경 대비). */
  deletingLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // 이 행은 서버가 그리는 <li> 안에 있어서 버튼이 자기 행을 지울 수 없다.
  // 목록에서 실제로 사라지는 건 router.refresh() 가 끝난 뒤다 → 그 사이를 pending 으로 알린다.
  // (종전에는 성공 경로에서 setBusy(false) 가 없어, 갱신이 늦거나 실패하면 버튼이 영영 잠겼다.)
  const [pending, startTransition] = useTransition();

  async function onDelete() {
    if (busy || pending) return;
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    const { error } = await createClient().rpc('hide_order', { p_order_id: orderId });
    setBusy(false);
    if (error) {
      window.alert(failedText);
      return;
    }
    startTransition(() => router.refresh()); // 숨김 처리 → 목록에서 사라진다
  }

  const working = busy || pending;

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={working}
      className="inline-flex items-center gap-1.5 rounded-md border border-grey-300 px-3 py-1.5 text-xs font-medium text-grey-500 transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
    >
      <Trash2 size={14} /> {working ? deletingLabel ?? label : label}
    </button>
  );
}
