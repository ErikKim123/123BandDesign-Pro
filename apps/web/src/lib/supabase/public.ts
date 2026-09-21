// 로그인 세션과 무관한 '공개 데이터' 전용 서버 클라이언트 (anon 키, 쿠키 미사용).
//
// 왜 따로 두나:
//   server.ts 의 createClient() 는 요청 쿠키를 붙여 보낸다. 그래서 로그인한 사용자의
//   액세스 토큰이 만료돼 있으면 PostgREST 가 401 을 돌려주고, 호출부의 catch 에 걸려
//   조용히 빈 결과가 된다. 상단 메뉴가 간헐적으로 코드 기본값(J&J 없는 목록)으로
//   떨어지던 원인이 이것이다 — 정작 menus 는 `is_active = true` 로 누구에게나 공개다.
//
//   공개 테이블만 읽는 조회는 애초에 세션이 필요 없다. 세션을 빼면 만료 토큰이
//   화면을 망가뜨릴 수 없고, 응답이 모든 사용자에게 동일해져 캐시도 걸 수 있다.
//
// ⚠️ 쓰면 안 되는 곳: 본인 데이터(주문·쿠폰·선물), 미리보기(draft/pending 상품)처럼
//    RLS 가 auth.uid() 로 갈라지는 조회. 그런 건 반드시 server.ts 의 createClient() 를 쓴다.
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // 서버에서 도는 익명 클라이언트 — 세션을 만들거나 저장하지 않는다.
    { db: { schema: DB_SCHEMA }, auth: { persistSession: false, autoRefreshToken: false } },
  );
}
