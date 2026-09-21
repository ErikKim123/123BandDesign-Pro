// Design Ref: §5 Phase 4 — 소셜 로그인(카카오) OAuth 콜백.
// PKCE: 브라우저가 시작한 OAuth 의 code_verifier 가 쿠키에 저장되므로 서버에서 code→세션 교환 가능.
// 교환 후 프로필이 없으면 일반사용자(customer)로 생성하고 원래 목적지로 복귀.
import { NextResponse, type NextRequest } from 'next/server';
import { notifyAdminSignup } from '@123band/shared';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { signApproval } from '@/lib/approval';

const LOCALES = ['en', 'ko', 'ja', 'zh-TW'];

/** 탈퇴(익명화) 때 이메일 자리에 넣는 봉인 주소의 꼬리표. */
const TOMBSTONE = '@deleted.invalid';

const sealed = (email: string | null | undefined) =>
  (email ?? '').trim().toLowerCase().endsWith(TOMBSTONE);

/**
 * 소셜 제공자가 알려준 진짜 이메일. 탈퇴하면서 auth 의 email 컬럼은 봉인 주소로 바뀌지만,
 * 제공자가 준 원래 주소는 두 군데에 남아 있다 — 되살릴 때 그걸 쓴다.
 *
 * 두 곳을 다 보는 이유: identities 는 세션에서 읽은 user 객체에 안 딸려 올 때가 있다.
 * 그러면 주소를 못 찾아 되살리기가 조용히 건너뛰어진다(실제로 한 번 그랬다).
 * user_metadata.email 은 소셜 로그인이 항상 채워 주므로 그쪽을 폴백으로 둔다.
 */
function providerEmail(user: {
  identities?: { identity_data?: Record<string, unknown> }[] | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const pick = (raw: unknown): string => {
    const mail = typeof raw === 'string' ? raw.trim() : '';
    return mail && !sealed(mail) ? mail : '';
  };
  for (const id of user.identities ?? []) {
    const mail = pick(id.identity_data?.email);
    if (mail) return mail;
  }
  return pick(user.user_metadata?.email);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { locale: string } },
) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '';
  const locale = params.locale;
  // 인증 복귀는 실제 콜백이 도착한 origin 기준으로. NEXT_PUBLIC_SITE_URL(빌드 박힘)을
  // 쓰면 Vercel 빌드에 localhost 가 들어간 경우 인증 후 localhost 로 되돌아간다.
  const base = url.origin;
  const fail = `${base}/${locale}/login?error=oauth`;

  // code 가 없으면 Supabase 가 에러 파라미터로 되돌려보낸 것(동의 거부/허용목록 누락 등).
  // 원문을 로그로 남겨 원인을 식별한다.
  if (!code) {
    const oauthErr = url.searchParams.get('error');
    const oauthDesc = url.searchParams.get('error_description');
    console.error('[auth/callback] no code', { oauthErr, oauthDesc, url: url.toString() });
    return NextResponse.redirect(fail);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // 대부분 PKCE code_verifier 쿠키 부재/불일치(localhost 멀티앱 쿠키 충돌 등).
    console.error('[auth/callback] exchange failed', { message: error.message, status: error.status });
    return NextResponse.redirect(fail);
  }

  // 프로필 보장 — 메타데이터 account_type 으로 역할 결정(소셜/일반=customer, 오거나이저 가입=partner)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const meta = user.user_metadata ?? {};

    // ── 탈퇴했던 계정으로 다시 들어온 경우 되살린다 ──
    //
    // 탈퇴(익명화)는 이메일을 봉인 주소로 바꿔 그 주소를 풀어준다. 이메일 로그인은 비밀번호까지
    // 무작위로 바뀌어 막히지만, 소셜 로그인은 이메일이 아니라 제공자 계정 ID로 매칭하기 때문에
    // 그 탈퇴된 계정으로 그대로 다시 들어온다. 그러면 로그인은 되는데 메일은 한 통도 안 나가는
    // 어중간한 상태가 남고 — 구매확인·알림·뉴스레터가 전부 조용히 막힌다 — 본인은 알 방법이 없다.
    //
    // 같은 소셜 계정으로 돌아왔다는 건 본인이 맞다는 뜻이므로 계정을 되살린다:
    // 이메일을 제공자가 알려준 주소로 되돌리고 탈퇴 표시를 지운다. 주문 이력은 그대로 이어진다.
    //
    // 판매 중이던 상품(inactive)과 오거나이저 정지는 되돌리지 않는다 — 로그인 한 번으로
    // 내려놨던 상품이 다시 올라가면 안 된다. 그건 운영자가 확인하고 풀 일이다.
    if (sealed(user.email) || meta.deleted === true || meta.withdrawn === true) {
      const admin = createAdminClient();
      const real = providerEmail(user);
      if (admin && real) {
        const { error: restoreErr } = await admin.auth.admin.updateUserById(user.id, {
          email: real,
          email_confirm: true, // 확인 메일 없이 즉시 반영
          user_metadata: { ...meta, deleted: null, withdrawn: null },
        });
        if (restoreErr) {
          // 되살리기 실패는 로그인을 막을 일은 아니다 — 봉인 상태 그대로 들어간다.
          console.error('[auth/callback] restore failed', { id: user.id, message: restoreErr.message });
        } else {
          await admin.from('profiles').update({ email: real }).eq('id', user.id);
        }
      }
    }
    const role = meta.account_type === 'partner' ? 'partner' : 'customer';
    const name = (meta.name as string | undefined) ?? (meta.full_name as string | undefined) ?? null;

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (!existing) {
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email ?? null,
        name,
        phone: user.phone ?? null,
        role,
        locale: LOCALES.includes(locale) ? locale : 'en',
        country: (meta.country as string | undefined) || null,
      });
    }

    // 오거나이저 가입이면 partners 행 생성(운영자 승인 대기)
    if (role === 'partner') {
      const { data: partner } = await supabase
        .from('partners')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!partner) {
        await supabase.from('partners').insert({
          user_id: user.id,
          company_name: (meta.company_name as string | undefined) || null,
          country: (meta.country as string | undefined) || null,
          biz_no: (meta.biz_no as string | undefined) || null,
          status: 'pending',
        });
      }
    }

    // 신규 자가가입(소셜/이메일확인) → 운영자 알림 (실패해도 진행). 오거나이저면 승인 링크 첨부.
    if (!existing) {
      const token = role === 'partner' ? signApproval(user.id) : null;
      const approveUrl = token ? `${base}/api/organizer/approve?uid=${user.id}&token=${token}` : null;
      await notifyAdminSignup(role, {
        email: user.email ?? '',
        name,
        company: (meta.company_name as string | undefined) ?? null,
        approveUrl,
      });
    }

    // 세션 분리 규칙: web 은 고객 전용. 기존 admin/partner 계정의 소셜 로그인 차단.
    // (메타데이터가 아닌 "저장된" profiles.role 로 판정)
    const { data: roleRow } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (roleRow && roleRow.role !== 'customer') {
      await supabase.auth.signOut({ scope: 'local' });
      return NextResponse.redirect(`${base}/${locale}/login?error=forbidden`);
    }
  }

  return NextResponse.redirect(`${base}/${locale}${next ? `/${next}` : ''}`);
}
