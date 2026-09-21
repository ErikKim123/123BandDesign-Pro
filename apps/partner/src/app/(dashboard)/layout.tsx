// Design Ref: §4.2 — role=partner 서버 가드 (2차 방어, RLS가 3차) + 반응형 셸
// 세션 + profiles.role + partners 행을 조회해 클라이언트 셸(PartnerShell)에 주입한다.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PartnerShell } from '@/components/layout/PartnerShell';
import type { PartnerInfo } from '@/lib/partner/context';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 비-partner 차단 — profiles.role 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single();

  // 입점정보(partners) — 본인 행 (RLS: partners_own). 아직 없으면 null.
  const { data: partner } = await supabase
    .from('partners')
    .select('id, company_name, commission_rate, status')
    .eq('user_id', user.id)
    .maybeSingle();

  // 들어올 수 있는 사람 둘:
  //   · 예전처럼 가입할 때 오거나이저를 고른 계정(role='partner')
  //   · 쓰던 고객 계정으로 신청해 승인받은 오거나이저(partners.status='active', 0116)
  // 뒤쪽은 역할이 'customer' 그대로다 — 역할을 바꾸면 그 사람이 web 의 자기 주문·뱃지에서 쫓겨난다.
  const approved = (partner as PartnerInfo | null)?.status === 'active';
  if (!profile || (profile.role !== 'partner' && !approved)) {
    redirect('/login?error=forbidden');
  }

  return (
    <PartnerShell
      session={{
        userId: user.id,
        email: profile.email ?? user.email ?? '',
        partner: (partner as PartnerInfo | null) ?? null,
      }}
    >
      {children}
    </PartnerShell>
  );
}
