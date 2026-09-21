// 가입 — 서버에서 service_role 로 "즉시 활성(email_confirm)" 계정 생성.
// 목적: Supabase 의 확인메일 발송을 트리거하지 않는다(운영은 Supabase 메일 미사용 → "Error
// sending confirmation email" 회피). 확인메일 없이 바로 로그인 가능. 운영자 알림만 Brevo 로 발송.
// service_role 미설정이면 noAdmin 신호 → 클라가 일반 signUp 으로 폴백.
import { NextResponse } from 'next/server';
import { notifyAdminSignup } from '@123band/shared';
import { SERVICE_TAG } from '@123band/shared/supabase/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { signApproval } from '@/lib/approval';
import { webBase } from '@/lib/web-url';

export async function POST(req: Request) {
  let body: {
    email?: string;
    password?: string;
    name?: string | null;
    phone?: string | null;
    account_type?: string;
    company_name?: string | null;
    country?: string | null;
    gender?: string | null;
    biz_no?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  const password = body.password ?? '';
  if (!email || !password) {
    return NextResponse.json({ error: 'email/password required' }, { status: 400 });
  }

  const admin = createAdminClient();
  // 키 없으면 클라가 기존 signUp 경로로 폴백하도록 신호
  if (!admin) return NextResponse.json({ ok: false, noAdmin: true });

  // account_type 은 'partner' 외에는 모두 customer 로 클램프(자가승격 방지)
  const role = body.account_type === 'partner' ? 'partner' : 'customer';
  const name = (body.name ?? '') || null;
  const phone = (body.phone ?? '') || null;
  const country = (body.country ?? '') || null; // ISO2 — 고객/오거나이저 공통 수집
  // 성별(선택, 0108) — 아는 값만. 트리거(handle_new_user)는 메타데이터의 성별을 모르므로 아래서 직접 적는다.
  const gender = ['female', 'male', 'other'].includes(body.gender ?? '') ? (body.gender as string) : null;
  const companyName = role === 'partner' ? (body.company_name ?? '') || null : null;

  // 즉시 활성 계정 생성(확인메일 미발송). admin_notified 플래그로 ensure 중복 알림 방지.
  // 국가는 공통 수집(메타데이터). 오거나이저면 회사/사업자번호도 담아 트리거가 partners 행에 반영.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      service: SERVICE_TAG, // DB 트리거가 보고 123Band 회원 태그·프로필을 만든다(울프 트리거는 건너뜀)
      name,
      phone,
      country,
      account_type: role,
      admin_notified: true,
      ...(role === 'partner'
        ? { company_name: companyName, biz_no: (body.biz_no ?? '') || null }
        : {}),
    },
  });
  if (error || !data.user) {
    const msg = error?.message ?? 'signup failed';
    const already = /registered|already/i.test(msg);
    return NextResponse.json(
      { error: msg, code: already ? 'already_registered' : 'failed' },
      { status: 400 },
    );
  }

  // ⚠️ 일부 GoTrue 버전에서 admin.createUser 는 email identity 를 만들지 않아
  //    이후 signInWithPassword 가 "Invalid login credentials" 로 실패한다.
  //    동일 비번으로 updateUserById 를 한 번 호출하면 email identity 가 생성되어 로그인 가능.
  await admin.auth.admin.updateUserById(data.user.id, { password });
  if (gender) await admin.from('profiles').update({ gender }).eq('id', data.user.id);

  // profiles(+오거나이저면 partners)는 DB 트리거(handle_new_user)가 생성.
  // 운영자에게 신규 가입 알림(Brevo). 오거나이저면 메일에 '승인하기' 링크 첨부.
  const user = data.user;
  const base = webBase(req);
  const token = role === 'partner' ? signApproval(user.id) : null;
  const approveUrl = token ? `${base}/api/organizer/approve?uid=${user.id}&token=${token}` : null;
  await notifyAdminSignup(role, { email, name, company: companyName, approveUrl });

  return NextResponse.json({ ok: true, userId: user.id });
}
