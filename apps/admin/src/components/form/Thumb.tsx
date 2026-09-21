// 목록 셀용 소형 이미지 미리보기 (StatusBadge 처럼 함수 호출로 셀에서 사용).
export function Thumb({ url }: { url: string | null }) {
  if (!url) return <span className="text-grey-400">—</span>;
  // 외부 CDN 다양성 → next/image 대신 일반 img
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-8 w-14 rounded object-cover" />;
}
