// 회원 탈퇴 — 본인 계정. 주문 이력(FK) 보존을 위해 하드삭제는 하지 않는다(영구 제거 X).
// - service_role 키가 있으면: 이메일을 tombstone 으로 교체 + 비번 잠금(완전 탈퇴, 재가입 가능).
// - 키가 없으면(폴백): 본인 세션으로 개인정보 익명화 + 탈퇴 표시(user_metadata) 후 로그아웃.
//   어느 경우에도 계정/주문 데이터를 영구 삭제하지 않는다.
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SERVICE_TAG } from '@123band/shared/supabase/schema';

/**
 * 소셜(구글 등) identity 연결 해제 — 탈퇴한 계정의 이메일을 실제로 "해방"시키기 위해서다.
 *
 * auth.users.email 만 tombstone 으로 바꾸면 이메일이 풀린 것처럼 보이지만, GoTrue 는
 * auth.identities 에 남은 원래 주소로도 중복을 판정한다. 그래서 같은 주소로 재가입하면
 * "이미 가입된 이메일"이 뜨고, 반대로 비밀번호 재설정은 auth.users.email 만 보기 때문에
 * "계정 없음"이 되어 메일이 안 나간다 — 가입도 재설정도 안 되는 상태로 갇힌다.
 *
 * GoTrue 에는 관리자용 해제 API 가 없고 unlink 는 본인 세션 토큰 전용인데, 탈퇴 계정은
 * 세션을 만들 수 없다. 그래서 마이그레이션 0099 의 SECURITY DEFINER 함수를 service_role 로 부른다.
 * 함수가 아직 배포되지 않았거나 실패해도 탈퇴는 계속 진행한다(이메일 해방만 늦어진다).
 */
async function unlinkSocialIdentities(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<void> {
  if (!admin) return;
  const { error } = await admin.rpc('purge_social_identities', { target_user: userId });
  if (error) console.error('purge_social_identities failed', error.message);
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // error 는 진단용(클라이언트가 로케일 라벨로 대체해 표시) — 사용자 문구로 쓰지 않는다.
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // 로그인 계정은 울프·JNJ 와 공유한다. 아래 탈퇴는 계정 자체를 지우거나 이메일을 바꾸므로
  // 123Band 에서만 쓰는 계정일 때만 진행한다(다른 서비스 계정까지 망가뜨리지 않게).
  const services = user.app_metadata?.services;
  if (!Array.isArray(services) || services.length !== 1 || services[0] !== SERVICE_TAG) {
    return NextResponse.json({ error: 'shared_account' }, { status: 409 });
  }

  const admin = createAdminClient();

  if (admin) {
    // ── 완전 탈퇴 (service_role) ──
    // 정책: 거래 이력(구매/판매)이 없으면 "완전 삭제"(이메일 해방 + 흔적 제거 → 깨끗한 재가입),
    //       이력이 있으면 "익명화 보존"(이메일 해방 + 개인정보 제거 + 주문 보존 → 재방문 고객 데이터 유지).
    const tombstone = `deleted+${user.id}@deleted.invalid`;
    const refCount = async (table: string, col: string) => {
      const { count } = await admin
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(col, user.id);
      return count ?? 0;
    };
    const purchases = await refCount('orders', 'buyer_id');
    const soldItems = await refCount('order_items', 'seller_id');

    if (purchases === 0 && soldItems === 0) {
      // 이력 없음 → 안 팔린 더미 상품 정리 후 계정 완전 삭제 (profiles/partners 는 FK 연쇄삭제)
      const { data: prods } = await admin.from('products').select('id').eq('seller_id', user.id);
      for (const p of prods ?? []) await admin.from('products').delete().eq('id', p.id);
      const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
      if (!delErr) return NextResponse.json({ ok: true, purged: true });
      // 완전 삭제 실패(예상 못한 FK) → 아래 익명화로 폴백 (이메일은 여전히 해방)
    }

    // 이력 있음(또는 완전삭제 실패) → 익명화 보존: 이메일 tombstone 교체 + 비번 잠금
    const { error: upErr } = await admin.auth.admin.updateUserById(user.id, {
      email: tombstone,
      email_confirm: true, // 확인 메일 없이 즉시 반영
      password: `${randomUUID()}${randomUUID()}`,
      user_metadata: { deleted: true },
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // 소셜 연결 해제 — 여기까지 해야 원래 주소가 진짜로 풀려 재가입/재설정이 가능하다.
    await unlinkSocialIdentities(admin, user.id);

    // 개인정보 익명화 (주문 내역의 buyer_id 참조는 유지)
    await admin.from('profiles').update({ name: null, phone: null, email: tombstone }).eq('id', user.id);
    // 오거나이저의 상품·행사패스 노출/판매 제거(주문 보존 위해 inactive) + 오거나이저 정지
    await admin.from('products').update({ status: 'inactive' }).eq('seller_id', user.id);
    await admin.from('partners').update({ status: 'suspended' }).eq('user_id', user.id);

    return NextResponse.json({ ok: true });
  }

  // ── 폴백: service_role 없이 본인 세션으로 소프트 탈퇴 (영구 삭제/이메일 변경 없음) ──
  // 탈퇴 표시(user_metadata) — 본인 토큰으로 가능
  const { error: metaErr } = await supabase.auth.updateUser({
    data: { withdrawn: true, withdrawn_at: new Date().toISOString() },
  });
  if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 500 });

  // 개인정보 익명화 (RLS: 본인 행 수정 허용). 주문 내역 참조는 유지.
  const { error: profErr } = await supabase
    .from('profiles')
    .update({ name: null, phone: null })
    .eq('id', user.id);
  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  // 오거나이저의 상품·행사패스 모두 노출/판매에서 제거 (본인 RLS, 주문 보존 위해 inactive)
  await supabase.from('products').update({ status: 'inactive' }).eq('seller_id', user.id);

  // 오거나이저(partners) 상태도 정지 (본인 RLS 허용 시)
  await supabase.from('partners').update({ status: 'suspended' }).eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}
