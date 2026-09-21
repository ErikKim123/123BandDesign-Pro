// 오거나이저 신청 알림 — 신청서를 낸 직후 브라우저가 한 번 부른다.
//
// 메일 내용은 요청 본문이 아니라 방금 저장된 그 사람의 partners 행에서 읽는다. 본문을 믿으면
// 아무나 남의 이름으로 '신청이 들어왔다'는 메일을 운영자에게 보낼 수 있다. 세션 사용자의
// 행만 읽으므로 보낼 수 있는 건 자기 신청서뿐이다.
//
// 메일이 실패해도 신청 자체는 이미 DB 에 들어가 있다 — 화면은 이 호출의 결과를 기다리지 않는다.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyAdminOrganizerApply } from '@123band/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: partner } = await supabase
    .from('partners')
    .select('company_name, country, contact, biz_no, intro, status, applied_at')
    .eq('user_id', user.id)
    .maybeSingle();

  // 심사 대기 중인 신청서가 있을 때만 — 이미 승인된 계정이 다시 불러도 메일은 안 나간다.
  if (!partner || partner.status !== 'pending' || !partner.applied_at) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  await notifyAdminOrganizerApply({
    email: user.email ?? '',
    name: profile?.name ?? null,
    company: partner.company_name ?? '(미입력)',
    country: partner.country,
    contact: partner.contact,
    bizNo: partner.biz_no,
    intro: partner.intro,
  });

  return NextResponse.json({ ok: true });
}
