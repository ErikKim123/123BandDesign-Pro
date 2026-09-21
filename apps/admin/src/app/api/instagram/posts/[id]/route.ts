// 예약 게시물 개별 수정/삭제. 관리자 전용.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { updatePost, deletePost } from '@/lib/instagram/posts';

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  if (body.scheduledAt !== undefined && Number.isNaN(Date.parse(body.scheduledAt))) {
    return bad('게시 예정 시각이 올바르지 않습니다.');
  }

  try {
    const post = await updatePost(params.id, {
      ...(body.scheduledAt !== undefined ? { scheduledAt: new Date(body.scheduledAt).toISOString() } : {}),
      ...(body.caption !== undefined ? { caption: String(body.caption) } : {}),
      ...(body.mediaType !== undefined ? { mediaType: body.mediaType === 'REELS' ? 'REELS' : 'IMAGE' } : {}),
      ...(body.mediaUrl !== undefined ? { mediaUrl: String(body.mediaUrl) } : {}),
      ...(body.thumbUrl !== undefined ? { thumbUrl: body.thumbUrl ? String(body.thumbUrl) : null } : {}),
    });
    return NextResponse.json({ post });
  } catch (err) {
    return bad(err instanceof Error ? err.message : '수정에 실패했습니다.', 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return bad(auth.error, auth.status);

  try {
    await deletePost(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(err instanceof Error ? err.message : '삭제에 실패했습니다.', 500);
  }
}
