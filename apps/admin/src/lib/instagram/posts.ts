// 예약 게시물(instagram_posts) 데이터 접근 + 발행 실행.
// 예약은 DB 에 있고 cron 이 발행하므로, 브라우저를 꺼도 예약 시각에 게시된다.
// ⚠️ 서버 전용.
import { igAdminClient } from './token';
import { publishToInstagram, type MediaType } from './publish';
import { resolveMediaUrl } from './drive';

export type PostStatus = 'scheduled' | 'publishing' | 'posted' | 'failed' | 'canceled';

export interface IgPost {
  id: string;
  scheduled_at: string;
  caption: string;
  media_type: MediaType;
  media_url: string;
  thumb_url: string | null;
  status: PostStatus;
  permalink: string | null;
  error: string | null;
  attempts: number;
  published_at: string | null;
  created_at: string;
}

const COLS =
  'id, scheduled_at, caption, media_type, media_url, thumb_url, status, permalink, error, attempts, published_at, created_at';

// 실패해도 이만큼까지만 재시도(토큰 만료 같은 영구 오류로 매분 재시도하는 것을 막는다).
const MAX_ATTEMPTS = 3;

/** 캘린더 표시용 — 기간 내 게시물. */
export async function listPosts(fromISO: string, toISO: string): Promise<IgPost[]> {
  const { data, error } = await igAdminClient()
    .from('instagram_posts')
    .select(COLS)
    .gte('scheduled_at', fromISO)
    .lt('scheduled_at', toISO)
    .order('scheduled_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as IgPost[];
}

export async function getPost(id: string): Promise<IgPost | null> {
  const { data, error } = await igAdminClient()
    .from('instagram_posts')
    .select(COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IgPost | null) ?? null;
}

export async function createPost(input: {
  scheduledAt: string;
  caption: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbUrl?: string | null;
  createdBy?: string | null;
}): Promise<IgPost> {
  const { data, error } = await igAdminClient()
    .from('instagram_posts')
    .insert({
      scheduled_at: input.scheduledAt,
      caption: input.caption,
      media_type: input.mediaType,
      media_url: input.mediaUrl,
      thumb_url: input.thumbUrl ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as IgPost;
}

/** 예약 수정. 이미 게시된 건 수정 불가(인스타에 올라간 것을 되돌릴 수 없다). */
export async function updatePost(
  id: string,
  patch: { scheduledAt?: string; caption?: string; mediaType?: MediaType; mediaUrl?: string; thumbUrl?: string | null },
): Promise<IgPost> {
  const current = await getPost(id);
  if (!current) throw new Error('게시물을 찾을 수 없습니다.');
  if (current.status === 'posted') throw new Error('이미 게시된 항목은 수정할 수 없습니다.');
  if (current.status === 'publishing') throw new Error('게시가 진행 중입니다. 잠시 후 다시 시도하세요.');

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.scheduledAt !== undefined) row.scheduled_at = patch.scheduledAt;
  if (patch.caption !== undefined) row.caption = patch.caption;
  if (patch.mediaType !== undefined) row.media_type = patch.mediaType;
  if (patch.mediaUrl !== undefined) row.media_url = patch.mediaUrl;
  if (patch.thumbUrl !== undefined) row.thumb_url = patch.thumbUrl;
  // 수정하면 실패 상태를 초기화해 다시 예약 대기로 돌린다.
  if (current.status === 'failed' || current.status === 'canceled') {
    row.status = 'scheduled';
    row.error = null;
    row.attempts = 0;
  }

  const { data, error } = await igAdminClient()
    .from('instagram_posts')
    .update(row)
    .eq('id', id)
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as IgPost;
}

export async function deletePost(id: string): Promise<void> {
  const current = await getPost(id);
  if (current?.status === 'publishing') throw new Error('게시가 진행 중입니다. 잠시 후 다시 시도하세요.');
  const { error } = await igAdminClient().from('instagram_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * 발행 잠금 — status 를 publishing 으로 원자적으로 바꾼다.
 * cron 이 겹쳐 돌아도 같은 게시물을 두 번 올리지 않도록, 조건부 update 의 반환행으로 소유권을 판정한다.
 */
async function claim(id: string): Promise<IgPost | null> {
  const { data, error } = await igAdminClient()
    .from('instagram_posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['scheduled', 'failed'])
    .select(COLS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IgPost | null) ?? null;
}

async function finish(
  post: IgPost,
  result: { ok: true; permalink?: string } | { ok: false; error: string },
): Promise<IgPost> {
  const row = result.ok
    ? {
        status: 'posted' as const,
        permalink: result.permalink ?? null,
        error: null,
        published_at: new Date().toISOString(),
        attempts: post.attempts + 1,
        updated_at: new Date().toISOString(),
      }
    : {
        status: 'failed' as const,
        error: result.error,
        attempts: post.attempts + 1,
        updated_at: new Date().toISOString(),
      };

  const { data, error } = await igAdminClient()
    .from('instagram_posts')
    .update(row)
    .eq('id', post.id)
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as IgPost;
}

/** 게시물 1건 발행(예약 대기 중이든 "지금 게시"든 공용). */
export async function publishPost(id: string): Promise<IgPost> {
  const claimed = await claim(id);
  if (!claimed) {
    const current = await getPost(id);
    if (!current) throw new Error('게시물을 찾을 수 없습니다.');
    if (current.status === 'posted') throw new Error('이미 게시된 항목입니다.');
    throw new Error('게시가 진행 중입니다. 잠시 후 다시 확인하세요.');
  }

  try {
    // 드라이브 링크 등은 인스타가 직접 못 받아가므로, 발행 직전에 공개 URL 로 변환한다.
    // 변환에 성공하면 행에도 반영해 재시도 시 다시 내려받지 않도록 한다.
    let mediaUrl = claimed.media_url;
    const resolved = await resolveMediaUrl(mediaUrl);
    if (resolved !== mediaUrl) {
      mediaUrl = resolved;
      await igAdminClient()
        .from('instagram_posts')
        .update({ media_url: resolved, updated_at: new Date().toISOString() })
        .eq('id', claimed.id);
    }

    const result = await publishToInstagram({
      mediaType: claimed.media_type,
      mediaUrl,
      caption: claimed.caption,
      thumbUrl: claimed.thumb_url,
    });
    return await finish(claimed, result);
  } catch (err) {
    // 예외로 빠져나가도 publishing 상태로 남지 않도록 반드시 실패로 마감한다.
    return await finish(claimed, {
      ok: false,
      error: err instanceof Error ? err.message : '발행 중 오류가 발생했습니다.',
    });
  }
}

/** cron 진입점 — 예약 시각이 지난 게시물을 순차 발행. */
export async function publishDuePosts(limit = 5): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const { data, error } = await igAdminClient()
    .from('instagram_posts')
    .select('id, attempts')
    .in('status', ['scheduled', 'failed'])
    .lte('scheduled_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  // 순차 처리 — 인스타 레이트리밋과 컨테이너 처리 대기를 고려.
  const out: { id: string; ok: boolean; error?: string }[] = [];
  for (const row of (data ?? []) as { id: string }[]) {
    try {
      const post = await publishPost(row.id);
      out.push({ id: row.id, ok: post.status === 'posted', error: post.error ?? undefined });
    } catch (err) {
      out.push({ id: row.id, ok: false, error: err instanceof Error ? err.message : '발행 실패' });
    }
  }
  return out;
}
