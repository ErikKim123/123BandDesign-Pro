// 예약 게시물 목록/생성. 관리자 전용.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listPosts, createPost } from '@/lib/instagram/posts';

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// 캘린더가 보고 있는 달의 범위를 그대로 받는다(?from=ISO&to=ISO).
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return bad(auth.error, auth.status);

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) return bad('조회 기간(from/to)이 필요합니다.');

  try {
    return NextResponse.json({ posts: await listPosts(from, to) });
  } catch (err) {
    return bad(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.', 500);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return bad(auth.error, auth.status);

  let body: {
    scheduledAt?: string;
    caption?: string;
    mediaType?: string;
    mediaUrl?: string;
    thumbUrl?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return bad('잘못된 요청 본문입니다.');
  }

  const scheduledAt = String(body.scheduledAt ?? '').trim();
  const mediaUrl = String(body.mediaUrl ?? '').trim();
  const mediaType = body.mediaType === 'REELS' ? 'REELS' : 'IMAGE';
  if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) return bad('게시 예정 시각이 올바르지 않습니다.');
  if (!mediaUrl) return bad('이미지 또는 동영상 URL이 필요합니다.');

  try {
    const post = await createPost({
      scheduledAt: new Date(scheduledAt).toISOString(),
      caption: String(body.caption ?? ''),
      mediaType,
      mediaUrl,
      thumbUrl: body.thumbUrl ? String(body.thumbUrl) : null,
      createdBy: auth.adminId,
    });
    return NextResponse.json({ post });
  } catch (err) {
    return bad(err instanceof Error ? err.message : '예약에 실패했습니다.', 500);
  }
}
