// 인스타그램 연동 설정 — 조회/저장. 관리자 전용.
// 토큰은 서버에서만 다룬다(브라우저로 절대 돌려주지 않음). 저장 시 60일 장기 토큰으로 교환.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { readIgSetting, saveIgSetting, daysUntilExpiry } from '@/lib/instagram/token';

// 장기 토큰 교환(Graph API 왕복)이 있어 기본 타임아웃보다 여유를 둔다.
export const maxDuration = 30;

function fail(err: unknown, fallback: string) {
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status: 500 });
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const s = await readIgSetting();
    // 토큰 본문은 내려보내지 않는다 — 저장 여부/만료 정보만.
    return NextResponse.json({
      handle: s.handle,
      hasToken: Boolean(s.token),
      longLived: s.longLived,
      expiresAt: s.expiresAt,
      daysLeft: daysUntilExpiry(s),
      refreshedAt: s.refreshedAt,
    });
  } catch (err) {
    return fail(err, '설정을 불러오지 못했습니다.');
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { handle?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  try {
    const { setting, exchanged, warning } = await saveIgSetting({
      handle: String(body.handle ?? ''),
      token: String(body.token ?? ''),
    });
    return NextResponse.json({
      ok: true,
      exchanged,
      warning,
      handle: setting.handle,
      hasToken: Boolean(setting.token),
      longLived: setting.longLived,
      expiresAt: setting.expiresAt,
      daysLeft: daysUntilExpiry(setting),
      refreshedAt: setting.refreshedAt,
    });
  } catch (err) {
    return fail(err, '저장에 실패했습니다.');
  }
}
