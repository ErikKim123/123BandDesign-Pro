// 고객(web) 전용 서버 가드 — 세션 분리 규칙(§4.2): web 은 customer 만 허용.
// admin/partner 계정은 web 의 보호 영역(계정/주문/결제)에 들어올 수 없다.
// 2차 방어(서버 컴포넌트). 1차는 로그인 시 역할 거부(AuthForm/콜백), 3차는 RLS.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** 로그인 + role=customer 보장. 아니면 로그인으로 보냄(미로그인 next 보존, 타역할 forbidden). */
export async function requireCustomer(locale: string, next?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'customer') {
    // admin/partner 계정 → web 접근 차단. 안내는 로그인 페이지에서.
    redirect(`/${locale}/login?error=forbidden`);
  }
  return user;
}
