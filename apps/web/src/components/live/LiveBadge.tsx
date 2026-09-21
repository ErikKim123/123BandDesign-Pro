// 방송 중 배지 — 이 기능의 유일한 새 시각 요소.
// 기존 배지 규칙(rounded-pill, ALL CAPS, 시맨틱 색)을 그대로 쓰고 붉은 점만 더한다.
// 점의 펄스는 prefers-reduced-motion 에서 멈춘다(globals.css 의 .live-pulse).
export function LiveBadge({ label = 'LIVE', className = '' }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill bg-danger/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-danger ${className}`}
    >
      <span className="live-pulse inline-flex h-1.5 w-1.5 rounded-pill bg-danger" aria-hidden />
      {label}
    </span>
  );
}
