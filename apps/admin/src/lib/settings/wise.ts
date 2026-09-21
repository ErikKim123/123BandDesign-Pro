// Wise 결제링크 설정 — app_settings['payment.wise'] 한 곳에서 관리한다.
// 체크아웃(웹)에서 카드결제 대안으로 노출하는 Wise 송금 링크. 값은 공개용(민감정보 아님)이지만
// 저장은 app_settings RLS(is_admin) 를 따르므로 관리자 세션 클라이언트로만 쓴다.
import type { SupabaseClient } from '@supabase/supabase-js';

export const WISE_KEY = 'payment.wise';

// 최초 기본값 — 관리자가 아직 저장한 적 없을 때 사용하는 링크(웹 기본 노출값과 동일).
export const DEFAULT_WISE_URL = 'https://wise.com/pay/me/f38iyvw?utm_source=request_flow';

export interface WiseSetting {
  /** Wise 결제 페이지 URL. 비우면 체크아웃에서 숨김. */
  url: string;
  /** 체크아웃 노출 여부. */
  enabled: boolean;
}

/** 저장된 Wise 설정을 읽는다. 행이 없으면 기본 링크(활성)를 돌려준다. */
export async function readWiseSetting(supabase: SupabaseClient): Promise<WiseSetting> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', WISE_KEY)
    .maybeSingle();
  if (error) throw new Error(`설정을 불러오지 못했습니다: ${error.message}`);

  // 미설정(행 없음) → 기본 링크를 활성 상태로 노출.
  if (!data) return { url: DEFAULT_WISE_URL, enabled: true };

  const v = (data.value ?? {}) as Partial<WiseSetting>;
  return {
    url: typeof v.url === 'string' ? v.url : '',
    enabled: v.enabled !== false,
  };
}

/** Wise 설정을 저장한다. url 은 트림, enabled 는 불리언으로 정규화. */
export async function writeWiseSetting(
  supabase: SupabaseClient,
  input: WiseSetting,
): Promise<WiseSetting> {
  const value: WiseSetting = { url: input.url.trim(), enabled: Boolean(input.enabled) };
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: WISE_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`설정을 저장하지 못했습니다: ${error.message}`);
  return value;
}
