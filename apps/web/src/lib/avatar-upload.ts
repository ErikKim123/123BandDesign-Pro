// 프로필 사진 업로드 헬퍼 — 회원이 올린 이미지를 정사각 webp 로 줄여 Storage 에 올린다.
//
// 브라우저에서 줄이는 이유: 폰 사진은 4MB 를 예사로 넘는데 이 사진이 쓰이는 가장 큰 자리가
// 136px 다. 원본을 그대로 두면 하트 목록 같은 데서 회원 수만큼 원본을 내려받게 된다.
// (서버에도 5MB 벽이 있지만, 그건 사고를 막는 벽이지 최적화가 아니다.)
'use client';

export const AVATAR_BUCKET = 'band123-member-avatars';

/**
 * 가운데를 정사각으로 잘라 size×size webp Blob 으로 만든다.
 *
 * 정사각으로 자르는 이유: 아바타는 어디서나 원형으로 잘려 보인다. 원본 비율을 유지하면
 * 세로 사진은 얼굴이 위아래로 잘리고, 가로 사진은 좌우가 잘린다. 가운데를 기준으로
 * 먼저 정사각을 잡아 두면 어느 화면에서 보든 같은 영역이 남는다.
 */
export async function downscaleSquare(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.round((bitmap.width - side) / 2);
  const sy = Math.round((bitmap.height - side) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  if (!blob) throw new Error('encode failed');
  return blob;
}
