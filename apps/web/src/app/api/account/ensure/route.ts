// 가입 직후 프로필/오거나이저(partners) 신청을 서버에서 보장 생성.
// 이메일 확인이 필요한 설정에서도 가입 즉시 어드민이 신청을 받도록 한다(세션 불필요).
// service_role 로 동작 — 키가 없으면 클라이언트 ensureProfile/콜백/DB 트리거에 위임.
import { NextResponse } from 'next/server';
import { notifyAdminSignup } from '@123band/shared';
import { isBand123Member } from '@123band/shared/supabase/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { signApproval } from '@/lib/approval';
import { webBase } from '@/lib/web-url';

export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, skipped: true });

  let userId = '';
  try {
    const body = (await req.json()) as { userId?: string };
    userId = (body.userId ?? '').trim();
  } catch {
    /* ignore */
  }
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  // 실제 auth 유저 확인 (위조 방지)
  const { data: got, error: getErr } = await admin.auth.admin.getUserById(userId);
  const user = got?.user;
  if (getErr || !user) return NextResponse.json({ error: 'user not found' }, { status: 404 });
  // 로그인 계정은 울프·JNJ 와 공유한다 — 123Band 회원이 아니면 아무것도 하지 않는다.
  if (!isBand123Member(user)) return NextResponse.json({ error: 'not a member' }, { status: 403 });

  // 이메일 자동 확인 → 확인 메일 없이 바로 로그인 가능하게
  if (!user.email_confirmed_at) {
    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const role = meta.account_type === 'partner' ? 'partner' : 'customer';
  const str = (k: string) => {
    const v = meta[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };

  // 프로필 보장 (없을 때만)
  const { data: existing } = await admin
    .from('profiles')
    .select('id, phone')
    .eq('id', user.id)
    .maybeSingle();
  if (!existing) {
    await admin.from('profiles').insert({
      id: user.id,
      email: user.email ?? null,
      name: str('name'),
      phone: str('phone'),
      role,
    });
  } else if (str('phone') && !existing.phone) {
    // 트리거 등으로 먼저 생성된 경우 전화번호 보정
    await admin.from('profiles').update({ phone: str('phone') }).eq('id', user.id);
  }

  // 오거나이저면 partners(pending) 보장
  if (role === 'partner') {
    const { data: partner } = await admin
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!partner) {
      await admin.from('partners').insert({
        user_id: user.id,
        company_name: str('company_name'),
        country: str('country'),
        biz_no: str('biz_no'),
        status: 'pending',
      });
    }
  }

  // 신규 가입이면 운영자에게 메일 알림 (오거나이저면 본문에 '승인하기' 링크 첨부).
  // ⚠️ 프로필은 DB 트리거(handle_new_user)가 먼저 만들 수 있으므로 !existing 으로 신규 판정하면
  //    알림이 누락된다. user_metadata.admin_notified 플래그로 "딱 한 번만" 발송(멱등).
  if (!meta.admin_notified) {
    const base = webBase(req);
    const token = role === 'partner' ? signApproval(user.id) : null;
    const approveUrl = token ? `${base}/api/organizer/approve?uid=${user.id}&token=${token}` : null;
    await notifyAdminSignup(role, {
      email: user.email ?? '',
      name: str('name'),
      company: str('company_name'),
      approveUrl,
    });
    // 중복 발송 방지 플래그 기록 (기존 메타 보존)
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...meta, admin_notified: true },
    });
  }

  return NextResponse.json({ ok: true });
}
