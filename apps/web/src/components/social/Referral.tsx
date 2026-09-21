// 친구 추천 QR 브리지 — 코드를 브라우저에 잠시 보관했다가, 로그인 이후 1회 반영한다.
// 가입 경로가 여러 갈래(이메일 가입 API / 구글 OAuth 콜백)라 서버 한 곳에서 처리할 수 없어
// "스캔 시점에 저장 → 로그인 후 적용" 으로 통일했다. 실제 검증(가입 7일 이내, 1회 한정,
// 자기 자신 불가)은 apply_referral RPC 가 DB에서 한다.
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const KEY = 'band_ref';

/** QR 랜딩/가입 링크에서 호출 — 추천 코드를 보관만 한다(렌더 없음). */
export function ReferralCapture({ code }: { code: string | null | undefined }) {
  useEffect(() => {
    const c = (code ?? '').trim().toUpperCase();
    if (!c) return;
    try {
      localStorage.setItem(KEY, c);
    } catch {
      // 프라이빗 모드 등 저장 불가 — 추천은 포기하고 나머지 흐름은 그대로 진행
    }
  }, [code]);
  return null;
}

/** 로그인된 화면(마이페이지)에서 호출 — 보관된 코드를 반영하고 지운다. */
export function ReferralApply({ myCode }: { myCode: string | null }) {
  const router = useRouter();

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      return;
    }
    if (!stored) return;
    // 한 번 시도했으면 성공/실패와 무관하게 지운다 — 매 진입마다 재시도하지 않도록.
    try {
      localStorage.removeItem(KEY);
    } catch {
      // 지우지 못해도 아래 RPC 가 already/expired 로 막아준다
    }
    if (myCode && stored === myCode) return; // 내 QR 을 내가 찍은 경우

    createClient()
      .rpc('apply_referral', { p_code: stored })
      .then(({ data }) => {
        const ok = (data as { ok?: boolean } | null)?.ok;
        if (ok) router.refresh();
      });
  }, [myCode, router]);

  return null;
}
