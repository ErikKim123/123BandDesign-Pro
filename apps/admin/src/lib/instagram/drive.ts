// 구글 드라이브 링크 → 인스타가 가져갈 수 있는 공개 URL 로 변환.
// 인스타 Graph API 는 media_url 을 자기 서버에서 직접 fetch 하는데, 드라이브 공유 링크
// (/file/d/ID/view)는 HTML 뷰어 페이지라 그대로는 못 받아간다. 대신 드라이브 "직다운로드"
// 엔드포인트(drive.usercontent.google.com/download?...&confirm=t)는 파일 바이트를 바로
// 200 으로 돌려주므로, 그 URL 로 바꿔 인스타가 직접 받아가게 한다.
// (서버가 내려받아 재업로드하지 않으므로 스토리지 용량 제한에 걸리지 않는다.)
// ⚠️ 서버 전용.

/** 다양한 드라이브 URL 형태에서 파일 ID 추출. 아니면 null. */
export function extractDriveId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{20,})/, // /file/d/ID/view
    /[?&]id=([a-zA-Z0-9_-]{20,})/, // uc?id=ID, open?id=ID, download?id=ID
    /\/d\/([a-zA-Z0-9_-]{20,})/, // /document/d/ID 등
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1]!;
  }
  return null;
}

/** 구글 드라이브(공유/미리보기/다운로드) 링크인지. */
export function isDriveUrl(url: string): boolean {
  return /(?:drive|docs)\.google\.com|drive\.usercontent\.google\.com/.test(url) && extractDriveId(url) !== null;
}

/** 이미 우리 Supabase 스토리지에 올라간(=인스타가 바로 받을 수 있는) URL 인지. */
export function isPublicMediaUrl(url: string): boolean {
  return /\/storage\/v1\/object\/public\//.test(url);
}

const DL_HOST = 'https://drive.usercontent.google.com/download';

/** 인스타가 직접 받아갈 수 있는 드라이브 직다운로드 URL. */
function directDownloadUrl(id: string): string {
  return `${DL_HOST}?id=${id}&export=download&confirm=t`;
}

/**
 * 미디어 URL 을 인스타가 fetch 가능한 형태로 정규화한다.
 * - 드라이브 공유/뷰어 링크(/file/d/ID/view) → 직다운로드 URL 로 변환
 * - 이미 직다운로드/공개 URL 이면 그대로 사용
 * 파일은 "링크가 있는 모든 사용자" 공유여야 인스타가 받아갈 수 있다.
 */
export async function resolveMediaUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed || isPublicMediaUrl(trimmed)) return trimmed;
  const id = extractDriveId(trimmed);
  if (!id) return trimmed; // 드라이브가 아니면 입력 URL 을 그대로 신뢰(직접 공개 URL 일 수 있음)
  return directDownloadUrl(id);
}
