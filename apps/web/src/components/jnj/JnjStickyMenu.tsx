// 대회 화면 상단 메뉴 두 줄(부문 탭 + 섹션 칩)을 한 덩어리로 헤더 아래에 붙인다.
// 스크롤해 내려가도 둘 다 남아 있어야 옆 부문으로 넘어가거나 섹션을 고를 수 있다.
//
// 높이는 부문 부제·줄바꿈에 따라 달라서 재서 CSS 변수(--jnj-menu-h)로 알린다 —
// 섹션의 scroll-margin 과 칩 바의 '보고 있는 섹션' 기준선이 이 값을 같이 쓴다.
'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export function JnjStickyMenu({ padTop, children }: { padTop: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--jnj-menu-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--jnj-menu-h');
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`sticky top-16 z-20 -mx-4 mb-10 border-b border-grey-200 bg-white px-4
                  shadow-[0_6px_16px_-10px_rgba(0,0,0,0.45)] sm:-mx-6 sm:px-6 ${padTop ? 'pt-3' : ''}`}
    >
      {children}
    </div>
  );
}
