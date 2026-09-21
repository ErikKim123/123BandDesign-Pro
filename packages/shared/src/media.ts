// Design Ref: 이벤트 미디어 — URL 하나로 유튜브/인스타/동영상/이미지를 자동 판별.
// 보안: 외부 URL 을 그대로 iframe src 에 넣지 않고, id 만 추출해 신뢰 도메인 임베드 주소를 생성한다.

export type MediaKind = 'youtube' | 'vimeo' | 'instagram' | 'video' | 'image';

export interface ResolvedMedia {
  kind: MediaKind;
  /** 렌더용 주소 (youtube/vimeo/instagram=임베드 URL, video/image=원본 URL) */
  src: string;
  id?: string;
}

const YT = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|v\/|live\/))([A-Za-z0-9_-]{11})/;
// 라이브 방송 등록에서 관리자가 붙여넣는 주소는 형태가 제각각이다.
// 위 YT 로 잡히지 않는 두 가지를 따로 본다: 스튜디오 주소와 ID 직접 입력.
const YT_STUDIO = /studio\.youtube\.com\/video\/([A-Za-z0-9_-]{11})/;
const YT_ID_ONLY = /^[A-Za-z0-9_-]{11}$/;
const YT_HOST = /(^|\.)(youtube(-nocookie)?\.com|youtu\.be)$/i;
// vimeo.com/76979871, /video/76979871, /channels/x/76979871, /groups/x/videos/76979871, player.vimeo.com/video/76979871
const VIMEO = /vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/;
const IG = /instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|svg)(\?|#|$)/i;

/**
 * 미디어 URL 을 종류별로 해석한다.
 * 판별 순서: youtube → vimeo → instagram → 동영상 확장자 → 이미지 확장자 → (확장자 없으면) 이미지로 가정.
 */
export function resolveMedia(rawUrl: string): ResolvedMedia {
  const url = (rawUrl ?? '').trim();

  const yt = url.match(YT);
  if (yt) {
    return { kind: 'youtube', id: yt[1], src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  }

  const vi = url.match(VIMEO);
  if (vi) {
    // 신뢰 도메인 + 추출한 숫자 id 만 사용 (임의 iframe src 주입 차단)
    return { kind: 'vimeo', id: vi[1], src: `https://player.vimeo.com/video/${vi[1]}` };
  }

  const ig = url.match(IG);
  if (ig) {
    // 신뢰 도메인 + 추출한 코드만 사용 (임의 iframe src 주입 차단)
    return { kind: 'instagram', id: ig[2], src: `https://www.instagram.com/${ig[1]}/${ig[2]}/embed` };
  }

  if (VIDEO_EXT.test(url)) return { kind: 'video', src: url };
  if (IMAGE_EXT.test(url)) return { kind: 'image', src: url };

  // 확장자 없는 이미지 호스트(picsum 등) → 이미지로 가정
  return { kind: 'image', src: url };
}

/**
 * 유튜브 영상 ID(11자) 추출 — 실패하면 null.
 *
 * 라이브 방송 등록의 사고 지점이다. 관리자가 어디서 복사해 오든 같은 ID 가 나와야 한다:
 *   watch?v=ID / youtu.be/ID / youtube.com/live/ID / embed/ID / shorts/ID
 *   studio.youtube.com/video/ID/livestreaming (스튜디오에서 그대로 복사한 주소)
 *   ID 11자 직접 입력
 * 파라미터 순서가 뒤바뀐 주소(watch?app=desktop&v=ID)까지 받도록 마지막에 쿼리스트링을 한 번 더 본다.
 */
export function youtubeVideoId(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  if (YT_ID_ONLY.test(raw)) return raw;

  const studio = raw.match(YT_STUDIO);
  if (studio?.[1]) return studio[1];

  const direct = raw.match(YT);
  if (direct?.[1]) return direct[1];

  // 마지막 폴백 — 유튜브 도메인일 때만 v= 쿼리를 읽는다(임의 도메인의 v= 는 받지 않는다).
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!YT_HOST.test(url.hostname)) return null;
    const v = url.searchParams.get('v');
    return v && YT_ID_ONLY.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** 상세페이지에서 재생 가능한(플레이어로 임베드되는) 동영상 종류인지. */
export function isPlayableVideo(kind: MediaKind): boolean {
  return kind === 'youtube' || kind === 'vimeo' || kind === 'video';
}

const SUPABASE_STORAGE_URL = /\.supabase\.co\/storage\/v1\/object\/public\//;

/**
 * Supabase Storage 공개 URL 인지 여부.
 * Vercel next/image 최적화(월간 무료 한도)를 우회할 대상을 가리는 데 쓴다 —
 * Storage 파일은 이미 정적으로 서빙되므로 최적화가 필요 없고, 한도 초과 시
 * `_next/image` 프록시가 402(OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED)를 반환해 이미지가 깨진다.
 */
export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  return !!url && SUPABASE_STORAGE_URL.test(url);
}

/** admin 입력 뱃지용 라벨 (한국어) */
export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  youtube: '유튜브',
  vimeo: '비메오',
  instagram: '인스타그램',
  video: '동영상',
  image: '이미지',
};
