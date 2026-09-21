// "지금 게시" — 예약 시각을 기다리지 않고 즉시 발행. 관리자 전용.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { publishPost } from '@/lib/instagram/posts';

// 동영상(릴스)은 인스타 트랜스코딩 대기가 있어 오래 걸린다.
export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const post = await publishPost(params.id);
    // 발행 자체가 실패한 경우에도 갱신된 행(실패 사유 포함)을 함께 돌려준다.
    return NextResponse.json({ ok: post.status === 'posted', post, error: post.error ?? undefined });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '게시에 실패했습니다.' },
      { status: 500 },
    );
  }
}
