// 로딩 자리표시(스켈레톤) — loading.tsx 들이 공유한다.
//
// 왜 필요한가: 고객몰 페이지는 대부분 동적 렌더(force-dynamic)라 링크를 누르면 서버 렌더가
// 끝날 때까지 화면이 그대로 멈춰 있었다. 실제 시간보다 훨씬 느리게 느껴지는 주된 이유다.
// loading.tsx 가 있으면 (1) 클릭 즉시 이 자리표시가 뜨고, (2) 동적 라우트라도 Link 프리페치가
// 이 경계까지는 미리 받아둔다.
//
// 색은 디자인 시스템 회색 토큰만 쓴다 — 실제 콘텐츠가 들어왔을 때 튀지 않게.

/** 회색 블록 하나. w/h 는 호출부에서 유틸리티로 준다. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-grey-200 ${className}`} aria-hidden />;
}

/** 카드 목록(상품·행사 그리드) 자리표시. */
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-grey-200">
          <SkeletonBlock className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-4">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 일반 페이지 자리표시 — 제목 + 본문 몇 줄.
 * 화면마다 모양이 다르므로 '대략 이 자리에 무언가 온다'까지만 알린다.
 */
export function SkeletonPage({ grid = false }: { grid?: boolean }) {
  return (
    <div className="container-band py-12 md:py-16" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <SkeletonBlock className="h-8 w-56 md:h-10 md:w-72" />
      <SkeletonBlock className="mt-4 h-4 w-full max-w-xl" />
      {grid ? (
        <SkeletonGrid />
      ) : (
        <div className="mt-8 space-y-3">
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-11/12" />
          <SkeletonBlock className="h-4 w-9/12" />
          <SkeletonBlock className="mt-8 h-48 w-full" />
        </div>
      )}
    </div>
  );
}
