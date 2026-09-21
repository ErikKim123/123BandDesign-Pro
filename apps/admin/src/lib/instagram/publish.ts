// 인스타그램 발행 엔진 — Graph API(비즈니스 계정)로 이미지/릴스를 실제로 올린다.
// 흐름: 저장된 토큰 → IG 유저 ID 해석 → 미디어 컨테이너 생성 → 처리 완료 대기 → media_publish → permalink.
// 예약 발행(cron)과 "지금 게시" 버튼이 이 함수를 공유한다.
// ⚠️ 서버 전용.
import { readIgSetting } from './token';

const GRAPH = 'https://graph.facebook.com/v21.0';

export type MediaType = 'IMAGE' | 'REELS';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Graph API 오류 메시지 추출.
function errMsg(j: unknown, fallback: string): string {
  return (j as { error?: { message?: string } } | null)?.error?.message || fallback;
}

/**
 * 컨테이너 처리 완료(FINISHED) 대기.
 * 이 대기 없이 media_publish 를 호출하면 "Media ID is not available" 로 실패한다.
 * 동영상은 인스타 쪽 트랜스코딩이 있어 이미지보다 훨씬 오래 걸린다.
 */
async function waitForContainer(
  creationId: string,
  token: string,
  mediaType: MediaType,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tries = mediaType === 'REELS' ? 30 : 8; // 릴스 최대 ~90초, 이미지 ~12초
  const interval = mediaType === 'REELS' ? 3000 : 1500;

  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
    const j = (await r.json()) as { status_code?: string; status?: string };
    if (j.status_code === 'FINISHED') return { ok: true };
    if (j.status_code === 'ERROR' || j.status_code === 'EXPIRED') {
      return { ok: false, error: j.status || '미디어 처리 실패(형식/비율/접근 가능 여부 확인).' };
    }
    await sleep(interval);
  }
  return {
    ok: false,
    error:
      mediaType === 'REELS'
        ? '동영상 처리 대기 시간 초과. 용량을 줄이거나 잠시 후 다시 시도하세요.'
        : '이미지 처리 대기 시간 초과. 잠시 후 다시 시도하세요.',
  };
}

/** 토큰에 연결된 IG 비즈니스 계정 ID. handle 이 있으면 우선 매칭. */
async function resolveIgUserId(token: string, handle: string): Promise<{ id: string } | { error: string }> {
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`,
  );
  const json = (await res.json()) as {
    data?: { instagram_business_account?: { id: string; username?: string } }[];
  };
  if (!res.ok) return { error: errMsg(json, '토큰으로 계정 정보를 불러오지 못했습니다. 토큰/권한을 확인하세요.') };

  const igs = (json.data ?? [])
    .map((p) => p.instagram_business_account)
    .filter((x): x is { id: string; username?: string } => Boolean(x?.id));
  if (igs.length === 0) {
    return {
      error:
        'IG 비즈니스 계정을 찾지 못했습니다. 인스타그램을 비즈니스/크리에이터로 전환하고 Facebook 페이지에 연결했는지 확인하세요.',
    };
  }
  const clean = handle.trim().replace(/^@/, '').toLowerCase();
  return { id: (igs.find((x) => (x.username ?? '').toLowerCase() === clean) ?? igs[0]!).id };
}

export interface PublishInput {
  mediaType: MediaType;
  mediaUrl: string;
  caption: string;
  /** 릴스 커버 이미지(선택). */
  thumbUrl?: string | null;
}

export type PublishResult = { ok: true; permalink?: string } | { ok: false; error: string };

/** 저장된 계정으로 게시물 1건 발행. */
export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const setting = await readIgSetting();
  if (!setting.token) {
    return { ok: false, error: '연결된 인스타그램 계정이 없습니다. 설정에서 인스타그램을 먼저 연결하세요.' };
  }
  if (!input.mediaUrl) return { ok: false, error: '이미지 또는 동영상이 없어 게시할 수 없습니다.' };

  const ig = await resolveIgUserId(setting.token, setting.handle);
  if ('error' in ig) return { ok: false, error: ig.error };

  // 1) 미디어 컨테이너 생성 — 이미지는 image_url, 동영상은 REELS + video_url.
  const payload: Record<string, unknown> =
    input.mediaType === 'REELS'
      ? {
          media_type: 'REELS',
          video_url: input.mediaUrl,
          caption: input.caption,
          ...(input.thumbUrl ? { cover_url: input.thumbUrl } : {}),
          access_token: setting.token,
        }
      : { image_url: input.mediaUrl, caption: input.caption, access_token: setting.token };

  const createRes = await fetch(`${GRAPH}/${ig.id}/media`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const createJson = (await createRes.json()) as { id?: string };
  if (!createRes.ok || !createJson.id) {
    return { ok: false, error: errMsg(createJson, '미디어 생성 실패(URL/형식 확인).') };
  }

  // 2) 처리 완료 대기
  const ready = await waitForContainer(createJson.id, setting.token, input.mediaType);
  if (!ready.ok) return { ok: false, error: ready.error };

  // 3) 발행
  const pubRes = await fetch(`${GRAPH}/${ig.id}/media_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ creation_id: createJson.id, access_token: setting.token }),
  });
  const pubJson = (await pubRes.json()) as { id?: string };
  if (!pubRes.ok || !pubJson.id) return { ok: false, error: errMsg(pubJson, '발행 실패.') };

  // 4) permalink 회수(실패해도 게시는 성공한 것)
  let permalink: string | undefined;
  try {
    const linkRes = await fetch(
      `${GRAPH}/${pubJson.id}?fields=permalink&access_token=${encodeURIComponent(setting.token)}`,
    );
    permalink = ((await linkRes.json()) as { permalink?: string }).permalink;
  } catch {
    /* permalink 회수 실패 무시 */
  }
  return { ok: true, permalink };
}
