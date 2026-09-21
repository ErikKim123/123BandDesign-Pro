// Supabase Storage 이미지를 표시 크기에 맞춰 받아오기 위한 헬퍼.
//
// 그동안 Storage 이미지는 원본을 그대로 내려받았다. 64~112px 썸네일 자리에 1.6MB 원본이
// 실리는 식이다. Vercel 이미지 최적화(_next/image)를 안 쓰는 건 의도된 것으로,
// Hobby 월 한도를 넘으면 402 를 반환해 이미지가 통째로 깨지기 때문이다
// (packages/shared/src/media.ts 주석 참고).
//
// ⚠️ next.config.js 의 images.loader:'custom' 으로 전역 처리하려다 헤더 로고가 404 로 사라진 적이 있다.
//    커스텀 로더를 켜면 Next 가 _next/image 라우트를 아예 만들지 않아, Storage 가 아닌 이미지
//    (로컬 로고·국기·외부 URL)까지 전부 깨진다. 그래서 전역 설정은 건드리지 않고,
//    Storage 이미지만 이 헬퍼로 주소를 바꿔 준다.
import { isSupabaseStorageUrl } from '@123band/shared';

/**
 * Supabase Storage URL 이면 변환 엔드포인트 URL로, 아니면 원본 그대로 돌려준다.
 * width 는 CSS 픽셀이 아니라 '실제로 받을 이미지 폭' — 고해상도 화면을 감안해 표시 크기의 2배를 준다.
 */
export function storageThumb(
  url: string | null | undefined,
  width: number,
  quality = 75,
): string | undefined {
  if (!url) return undefined;
  if (!isSupabaseStorageUrl(url)) return url;
  const base = url.replace('/object/public/', '/render/image/public/');
  return `${base}?width=${width}&quality=${quality}&resize=contain`;
}

/**
 * Storage 이미지를 <Image> 에 넘길 때 쓰는 props.
 *
 * unoptimized 는 Storage URL 일 때만 켠다 — 로컬/외부 이미지는 종전대로 Vercel 최적화를 탄다.
 * width 는 그 자리에서 가장 크게 보이는 크기의 약 2배(고해상도 화면 대비)를 준다.
 * unoptimized 라 srcset 이 생기지 않으므로 화면 크기별 분기 없이 이 한 장을 모두가 받는다
 * → 데스크톱 최대치가 아니라 '흔한 크기'를 기준으로 잡는다.
 */
export function storageImageProps(
  url: string,
  width: number,
): { src: string; unoptimized: boolean } {
  return { src: storageThumb(url, width) ?? url, unoptimized: isSupabaseStorageUrl(url) };
}

/**
 * Storage 이미지의 반응형 srcset — 화면 폭에 맞는 크기 한 장만 받게 한다.
 *
 * storageImageProps 는 한 장(unoptimized)이라 폰도 데스크톱 크기를 받는다. 배너처럼 화면마다
 * 차지하는 폭이 크게 다른 곳에서는 폭별로 여러 장을 적어 두고 브라우저가 고르게 한다.
 * Supabase 변환은 브라우저가 webp 를 받는다고 하면 webp 로 돌려준다(원본 PNG 4.5MB → 약 74KB).
 * Storage 가 아닌 주소는 그대로 한 장.
 */
export function storageSrcSet(
  url: string,
  widths: number[],
  quality = 70,
): { src: string; srcSet?: string } {
  if (!isSupabaseStorageUrl(url)) return { src: url };
  const sorted = [...widths].sort((a, b) => a - b);
  return {
    src: storageThumb(url, sorted[sorted.length - 1] ?? 800, quality) ?? url,
    srcSet: sorted.map((w) => `${storageThumb(url, w, quality)} ${w}w`).join(', '),
  };
}
