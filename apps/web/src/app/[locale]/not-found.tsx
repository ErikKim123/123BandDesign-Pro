// Design Ref: §6 — not-found (Next.js 제약상 locale params 미수신 → 양언어 병기)
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-band flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-display text-5xl">404</h1>
      <p className="text-grey-500">Page not found · 페이지를 찾을 수 없습니다</p>
      <Link href="/" className="btn btn-secondary btn-sm">
        Home · 홈
      </Link>
    </div>
  );
}
