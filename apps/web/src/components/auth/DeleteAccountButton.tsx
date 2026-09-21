// 회원 탈퇴 버튼 — 확인 후 /api/account/delete 호출 → 로그아웃 + 홈으로.
'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/lib/cart/CartContext';

export function DeleteAccountButton({
  locale,
  label,
  confirmText,
  failedText,
}: {
  locale: string;
  label: string;
  confirmText: string;
  failedText: string;
}) {
  const [loading, setLoading] = useState(false);
  const { purge } = useCart();

  async function onDelete() {
    if (loading) return;
    if (!window.confirm(confirmText)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        // 서버 error 는 로케일 미상(+Supabase 원문)이라 사용자에게 노출하지 않는다. 진단은 콘솔로.
        const d = await res.json().catch(() => ({}));
        console.error('account delete failed:', d.error ?? res.status);
        window.alert(failedText);
        setLoading(false);
        return;
      }
      // 탈퇴한 계정의 장바구니 제거 — 반드시 signOut 전에(로그아웃 후엔 대상 키를 알 수 없다).
      purge();
      // 차단된 세션 정리 후 홈으로 (하드 내비로 서버 재렌더 보장)
      await createClient().auth.signOut({ scope: 'local' });
      window.location.assign(`/${locale}`);
    } catch {
      window.alert(failedText);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={loading}
      className="flex w-fit items-center gap-2 text-xs text-grey-400 underline-offset-2 hover:text-danger hover:underline disabled:opacity-60"
    >
      <Trash2 size={14} /> {label}
    </button>
  );
}
