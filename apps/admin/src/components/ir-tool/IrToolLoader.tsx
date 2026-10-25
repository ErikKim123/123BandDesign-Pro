'use client';
import dynamic from 'next/dynamic';

// Polotno/konva 는 브라우저 전용 — 서버 렌더 제외
const IrEditor = dynamic(() => import('./IrEditor'), {
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center text-sm text-grey-500">Loading…</div>,
});

export function IrToolLoader() {
  return <IrEditor />;
}
