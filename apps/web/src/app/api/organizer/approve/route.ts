// 이메일 승인 링크 처리 — 서명 토큰 검증 후 오거나이저(partners) 상태를 active 로.
// service_role 로 동작(어드민 세션 불필요). 결과는 간단한 HTML 페이지로 응답.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyApproval } from '@/lib/approval';

function page(title: string, msg: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <body style="font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f7f7f7">
       <div style="background:#fff;border:1px solid #eee;border-radius:16px;padding:32px 40px;text-align:center;max-width:420px">
         <div style="font-size:40px">${ok ? '✅' : '⚠️'}</div>
         <h1 style="font-size:20px;margin:12px 0 6px">${title}</h1>
         <p style="color:#666;font-size:14px;line-height:1.6;margin:0">${msg}</p>
       </div>
     </body></html>`,
    { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const uid = url.searchParams.get('uid') ?? '';
  const token = url.searchParams.get('token') ?? '';

  if (!verifyApproval(uid, token)) {
    return page('승인 실패', '유효하지 않거나 만료된 승인 링크입니다.', false);
  }

  const admin = createAdminClient();
  if (!admin) {
    return page('승인 불가', '서버에 승인 권한이 설정되어 있지 않습니다. (SUPABASE_SERVICE_ROLE_KEY 필요)', false);
  }

  const { data, error } = await admin
    .from('partners')
    .update({ status: 'active' })
    .eq('user_id', uid)
    .select('id, company_name');
  if (error) return page('승인 실패', error.message, false);
  if (!data || data.length === 0) {
    return page('대상 없음', '해당 오거나이저 신청을 찾을 수 없습니다. 이미 처리되었거나 삭제되었을 수 있습니다.', false);
  }

  const name = data[0]?.company_name ?? '';
  return page('승인 완료', `${name ? `'${name}' ` : ''}오거나이저가 활성(승인) 처리되었습니다.`, true);
}
