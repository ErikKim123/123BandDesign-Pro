// 업로드 전 브라우저에서 이미지 다운스케일+압축. 큰 원본도 작게(용량/비용 절감).
'use client';

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read failed'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image load failed'));
    i.src = src;
  });
}

/**
 * 캔버스에 그려진 그림에 투명한 픽셀이 있는지.
 * 뱃지·로고처럼 배경이 비어 있는 PNG 를 흰 배경 JPEG 로 눌러버리면 어두운 배경 위에서 흰 네모가 된다.
 * 전수 검사는 큰 이미지에서 느리므로 일정 간격으로 건너뛰며 본다(투명 영역은 보통 넓어서 이걸로 충분).
 */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4 * 16) {
      const alpha = data[i];
      if (alpha !== undefined && alpha < 250) return true;
    }
    return false;
  } catch {
    // 캔버스가 오염된 경우(교차 출처 등) — 안전한 쪽(투명 보존)으로.
    return true;
  }
}

/**
 * 긴 변 maxEdge 이하로 줄여서 Blob 반환. 실패 시 원본 반환.
 *
 * 투명한 픽셀이 있으면 PNG 로(투명 유지), 없으면 흰 배경 JPEG 로 인코딩한다.
 * 반환값의 `type` 을 보고 업로드 경로의 확장자·contentType 을 정할 것 —
 * 원본 확장자를 그대로 쓰면 실제 내용과 어긋난다.
 */
export async function downscaleImageToBlob(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<Blob> {
  try {
    const img = await loadImage(await readDataUrl(file));
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // 먼저 그대로 그려서 투명 여부를 본다.
    ctx.drawImage(img, 0, 0, w, h);
    const transparent = hasTransparency(ctx, w, h);

    if (!transparent) {
      // 불투명 → 흰 배경 깔고 다시 그린 뒤 JPEG (사진은 JPEG 가 훨씬 작다)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
    }

    const type = transparent ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), type, quality),
    );
    // 줄여도 원본보다 커지는 경우(작은 PNG 등)는 원본을 그대로 쓴다.
    if (!blob) return file;
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** downscaleImageToBlob 결과에 맞는 확장자. Blob 이 아닌 원본 File 이 돌아온 경우도 처리. */
export function blobExt(blob: Blob, fallback = 'jpg'): string {
  if (blob.type === 'image/png') return 'png';
  if (blob.type === 'image/jpeg') return 'jpg';
  if (blob.type === 'image/webp') return 'webp';
  if (blob instanceof File) return blob.name.split('.').pop()?.toLowerCase() || fallback;
  return fallback;
}

/**
 * Storage 업로드 캐시 수명 — 1년.
 * 업로드 경로에 타임스탬프가 들어가 같은 URL 의 내용이 바뀌지 않으므로(수정 = 새 경로) 길게 잡아도 안전하다.
 * 종전 3600(1시간)은 재방문마다 이미지를 다시 받게 만들었다.
 */
export const UPLOAD_CACHE_CONTROL = '31536000';
