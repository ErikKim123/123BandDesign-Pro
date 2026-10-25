'use client';
// Konva 는 브라우저(window)에서만 돌아가므로 서버 렌더링 없이 불러온다.
import dynamic from 'next/dynamic';

const IrStudio = dynamic(() => import('./IrStudio'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#252a31', color: '#abb3bf' }}>
      IR 에디터를 불러오는 중…
    </div>
  ),
});

export function IrStudioLoader() {
  return <IrStudio />;
}
