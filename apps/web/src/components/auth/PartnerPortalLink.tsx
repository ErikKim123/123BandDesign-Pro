// Design Ref: §4.2 — web→partner SSO 핸드오프.
// web/partner 는 서로 다른 도메인(별도 세션 쿠키)이라 쿠키 공유가 불가능하다.
// 링크 클릭 시 현재 web 세션 토큰을 partner /login 으로 넘겨(URL 해시 — 서버/Referer
// 에 안 실림) partner 가 setSession 후 대시보드로 보낸다.
'use client';
import { useState } from 'react';
import { Store, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function PartnerPortalLink({ baseUrl, label }: { baseUrl: string; label: string }) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    // 새 탭으로 열기 — 클릭 즉시 빈 탭을 동기로 열어야 팝업 차단을 피한다(await 이후 open 은 차단됨).
    const win = window.open('about:blank', '_blank');
    let target = `${baseUrl}/login`;
    try {
      const { data } = await createClient().auth.getSession();
      const s = data.session;
      if (s?.access_token && s?.refresh_token) {
        const h = new URLSearchParams({ sso_at: s.access_token, sso_rt: s.refresh_token });
        target = `${baseUrl}/login#${h.toString()}`;
      }
    } catch {
      // 세션 조회 실패 시 그냥 로그인 페이지로 이동 (수동 로그인)
    }
    if (win) {
      win.opener = null; // 새 탭에서 원본 창 참조 차단(토큰 보호)
      win.location.href = target;
    } else {
      // 팝업이 차단된 경우 같은 탭으로 폴백
      window.location.href = target;
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={loading}
      className="flex w-full items-center gap-3 rounded-lg border border-grey-900 bg-grey-900 p-4 text-white hover:bg-grey-800 disabled:opacity-60"
    >
      <Store size={18} />
      <span className="flex-1 text-left font-medium">{label}</span>
      <ExternalLink size={18} className="text-white/70" />
    </button>
  );
}
