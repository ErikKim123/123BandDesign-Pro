// Design Ref: §5 Phase 4 — 로그아웃 (세션 종료 후 홈으로)
'use client';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton({ locale, label }: { locale: string; label: string }) {
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      // local 스코프: 서버 revoke 왕복 없이 로컬 세션 쿠키만 즉시 제거 → 한 번에 확실히.
      await createClient().auth.signOut({ scope: 'local' });
    } catch {
      // 실패해도 어차피 하드 내비로 서버가 쿠키를 다시 읽으니 진행
    }
    // 장바구니는 지우지 않는다 — 사용자별 키로 보관되므로 재로그인 시 그대로 복원된다.
    // (비로그인 화면에서는 CartProvider 가 메모리를 비워 노출되지 않는다)
    // 하드 내비게이션: 서버 컴포넌트가 비워진 쿠키로 재렌더되도록 보장(RSC 캐시 우회).
    window.location.assign(`/${locale}`);
  }

  return (
    <button type="button" onClick={logout} disabled={loading} className="btn btn-secondary btn-sm w-fit">
      <LogOut size={16} /> {label}
    </button>
  );
}
