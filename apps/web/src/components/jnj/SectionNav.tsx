// 대회 화면의 섹션 칩 바 — 지금 보고 있는 섹션의 칩이 오렌지로 켜진다.
//
// 왜 클라이언트인가: '지금 어디를 보고 있나'는 스크롤에 따라 바뀐다. 주소의 #해시로만
// 판단하면 눌러서 이동했을 때만 맞고, 손으로 스크롤해 내려가면 칩은 처음 누른 자리에 멈춰 있다.
//
// 판정은 스크롤 위치로 한다(IntersectionObserver 대신): 섹션마다 길이가 제각각이라
// '얼마나 보이나'로 고르면 긴 섹션이 짧은 섹션을 계속 이긴다. 화면 위쪽 기준선을 지나간
// 섹션 중 마지막 것 — 읽고 있는 자리와 가장 가깝다.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 헤더(64) + 상단 메뉴(부문 탭 + 칩 바, JnjStickyMenu 가 잰 높이) 바로 아래.
 * 이 선을 지나간 섹션을 '보고 있는 중'으로 친다. 메뉴 높이를 아직 모르면 칩 바만(56) 친다.
 */
function sectionLine(): number {
  const menu = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jnj-menu-h'));
  return 64 + (Number.isFinite(menu) ? menu : 56) + 20;
}

export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string>('');
  const barRef = useRef<HTMLDivElement>(null);

  const sync = useCallback(() => {
    let current = '';
    const line = sectionLine();
    for (const it of items) {
      const el = document.getElementById(it.id);
      if (el && el.getBoundingClientRect().top <= line) current = it.id;
    }
    // 페이지 끝에서는 마지막 섹션이 기준선을 못 넘을 수 있다(짧은 섹션). 그럼 마지막 것으로.
    const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
    if (atBottom && items.length > 0) current = items[items.length - 1]!.id;
    // 첫 섹션 위(개요)에서는 아무 칩도 켜지 않는다 — 거긴 어느 섹션도 아니다.
    setActive(current);
  }, [items]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };
    sync();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sync]);

  // 켜진 칩이 칩 바 밖으로 밀려나 있으면 끌어온다 — 칩이 많아 옆으로 넘기는 모바일에서
  // '지금 여기' 표시가 화면 밖에 있으면 켜진 의미가 없다.
  useEffect(() => {
    if (!active) return;
    const bar = barRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!bar || !chip) return;
    const left = chip.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + chip.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollTo({ left: left - 16, behavior: 'smooth' });
    }
  }, [active]);

  if (items.length < 2) return null;

  return (
    // 헤더 아래 붙는 건 부문 탭과 한 덩어리인 JnjStickyMenu 가 맡는다.
    <nav>
      <div
        ref={barRef}
        className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => {
          const on = it.id === active;
          return (
            <a
              key={it.id}
              href={`#${it.id}`}
              data-chip={it.id}
              aria-current={on ? 'true' : undefined}
              // 누른 즉시 켠다 — 스크롤이 끝나기를 기다리면 누른 손이 반응을 못 본다.
              onClick={() => setActive(it.id)}
              className={`shrink-0 rounded-pill border px-4 py-1.5 text-[13px] font-medium transition-colors ${
                on
                  ? 'border-primary bg-primary text-white'
                  : 'border-grey-300 text-grey-800 hover:border-primary hover:bg-primary hover:text-white'
              }`}
            >
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
