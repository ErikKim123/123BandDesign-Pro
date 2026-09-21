// 구글 시트 일괄 업데이트 — 미리보기(commit=false) / 등록(commit=true). 관리자 전용.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { previewSheet, commitSheet } from '@/lib/instagram/import';

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return bad(auth.error, auth.status);

  let body: { url?: string; commit?: boolean };
  try {
    body = await req.json();
  } catch {
    return bad('잘못된 요청 본문입니다.');
  }

  const url = String(body.url ?? '').trim();
  if (!url) return bad('구글 시트 링크를 입력하세요.');
  if (!/docs\.google\.com\/spreadsheets/.test(url)) return bad('구글 시트 링크가 아닙니다.');

  try {
    if (body.commit) {
      return NextResponse.json({ result: await commitSheet(url, auth.adminId) });
    }
    return NextResponse.json({ preview: await previewSheet(url) });
  } catch (err) {
    return bad(err instanceof Error ? err.message : '시트를 처리하지 못했습니다.', 500);
  }
}
