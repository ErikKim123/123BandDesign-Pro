// Wise 결제링크 조회 — 어드민 설정(app_settings['payment.wise'])을 읽어 체크아웃에 노출할 URL 을 돌려준다.
// app_settings 는 RLS(is_admin)로 anon 읽기가 막혀 있어 service_role 클라이언트로 조회한다.
// ⚠️ 서버 전용(서버 컴포넌트/라우트에서만 import). 클라이언트 번들 금지.
import { createAdminClient } from '@/lib/supabase/admin';

const WISE_KEY = 'payment.wise';
// 관리자가 아직 저장한 적 없을 때의 기본 링크(어드민 기본값과 동일).
const DEFAULT_WISE_URL = 'https://wise.com/pay/me/f38iyvw?utm_source=request_flow';

/** 체크아웃에 노출할 Wise 결제 URL. 관리자가 비활성화했거나 링크를 비웠으면 빈 문자열. */
export async function getWiseCheckoutUrl(): Promise<string> {
  const admin = createAdminClient();
  // 서비스롤 키 미설정 → 기본 링크로 폴백(로컬 개발 편의).
  if (!admin) return DEFAULT_WISE_URL;
  try {
    const { data } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', WISE_KEY)
      .maybeSingle();
    // 미설정(행 없음) → 기본 링크 노출.
    if (!data) return DEFAULT_WISE_URL;
    const v = (data.value ?? {}) as { url?: string; enabled?: boolean };
    const url = typeof v.url === 'string' ? v.url.trim() : '';
    return v.enabled !== false && url ? url : '';
  } catch {
    // 조회 실패 시에도 결제 흐름을 막지 않도록 기본 링크로 폴백.
    return DEFAULT_WISE_URL;
  }
}
