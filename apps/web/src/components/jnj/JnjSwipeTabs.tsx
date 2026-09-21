// 부문 탭 스와이프 — 모바일에서 본문을 좌우로 밀면 옆 부문 탭으로 넘어간다.
// 탭 링크와 같은 주소(서버 렌더)로 이동하고, 탭처럼 보던 위치를 지킨다(scroll: false).
//
// 부드럽게 넘어가는 세 가지 장치:
//  1) 옆 부문은 화면 전체를 미리 받아 둔다(PrefetchKind.FULL). 기본 prefetch 는 동적 페이지에서
//     loading.tsx 까지만 받아서, 넘기는 순간 서버를 기다리며 스켈레톤이 번쩍 끼어들었다.
//  2) 손가락을 1:1 로 따라가고, 놓으면 그 속도를 이어받아 화면 밖까지 미끄러진다.
//  3) 다 빠져나간 뒤에 주소를 바꾸고(캐시에서 즉시 그려짐), 새 부문은 반대편 끝에서 감속하며 들어온다.
'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';

/** 놓았을 때 이어받는 감속 곡선 — 처음은 손가락 속도, 끝은 부드럽게 멈춘다. */
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** 가로로 스크롤되는 곳(칩 줄, 표, 갤러리)이나 입력칸에서 시작한 제스처는 그쪽 몫이다. */
function startsInOwnGesture(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return true;
    const ox = getComputedStyle(el).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
    el = el.parentElement;
  }
  return false;
}

export function JnjSwipeTabs({
  prevHref,
  nextHref,
  activeCode,
  activeIndex,
  children,
}: {
  prevHref: string | null;
  nextHref: string | null;
  /** 바뀌면 새 부문이 도착한 것 — 들어오는 애니메이션을 돌리고 탭 줄의 선택 탭을 보이게 옮긴다. */
  activeCode: string;
  /** 탭 순서 — 탭을 눌러 바꿨을 때도 어느 쪽에서 들어올지 정한다. */
  activeIndex: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // 최신 링크 — 터치 리스너는 한 번만 붙이므로 ref 로 읽는다.
  const hrefs = useRef({ prevHref, nextHref });
  hrefs.current = { prevHref, nextHref };
  /** 스와이프로 넘어가는 중인 방향(다음 = 1, 이전 = -1). 0 이면 대기. */
  const pending = useRef(0);
  const lastIndex = useRef(activeIndex);
  const fallback = useRef<number | undefined>(undefined);

  // 옆 부문 화면을 통째로 미리 받아 둔다 — 넘기는 순간 캐시에서 바로 그려지게.
  useEffect(() => {
    for (const href of [prevHref, nextHref]) {
      if (href) router.prefetch(href, { kind: PrefetchKind.FULL });
    }
  }, [prevHref, nextHref, router]);

  /** 본문 위치·투명도. ms 가 0 이면 즉시(끄는 중), 아니면 전환. 움직일 때만 GPU 레이어를 켠다. */
  const place = (x: number, opacity: number, ms: number, easing = EASE_OUT) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms ${easing}, opacity ${ms}ms ${easing}` : 'none';
    el.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    el.style.opacity = opacity >= 1 ? '' : String(opacity);
    el.style.willChange = x || ms ? 'transform' : '';
  };

  // 전환이 끝나면 레이어를 내린다 — 긴 본문을 계속 GPU 에 올려 두면 폰에서 오히려 버벅인다.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const done = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform' && !el.style.transform) {
        el.style.willChange = '';
        el.style.transition = '';
      }
    };
    el.addEventListener('transitionend', done);
    return () => el.removeEventListener('transitionend', done);
  }, []);

  // 새 부문 도착 — 스와이프면 반대편 끝에서, 탭을 눌렀으면 그 방향에서 살짝 밀려 들어온다.
  useEffect(() => {
    const row = document.querySelector<HTMLElement>('[data-division-tabs]');
    // 줄 맨 앞의 종류 스위치(J&J·BATTLE·SHOW)도 aria-current 를 쓰므로 부문 탭만 집는다 —
    // 그냥 [aria-current] 로 찾으면 스위치가 먼저 걸려 선택한 부문이 화면 밖에 남는다.
    const tab = row?.querySelector<HTMLElement>('[data-division-tab][aria-current="page"]');
    if (row && tab) {
      const left = tab.offsetLeft - row.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
      row.scrollTo({ left, behavior: 'smooth' });
    }

    const width = rootRef.current?.clientWidth ?? 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const swiped = pending.current;
    const tapped = Math.sign(activeIndex - lastIndex.current);
    lastIndex.current = activeIndex;
    pending.current = 0;
    window.clearTimeout(fallback.current);

    if (reduced || (!swiped && !tapped)) {
      place(0, 1, 0);
      return;
    }
    // 스와이프: 화면 끝에서 통째로 / 탭: 가까이서 짧게 — 누른 손은 긴 이동을 기다리지 않는다.
    const from = swiped ? swiped * width : tapped * width * 0.25;
    place(from, swiped ? 1 : 0.4, 0);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => place(0, 1, swiped ? 380 : 260)),
    );
  }, [activeCode, activeIndex]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let start: { x: number; y: number } | null = null;
    let mode: 'idle' | 'undecided' | 'drag' = 'idle';
    let dx = 0;
    // 속도는 마지막 순간의 움직임으로 잰다 — 처음부터의 평균이면 느리게 끌다 튕긴 손을 못 알아본다.
    let lastX = 0;
    let lastT = 0;
    let velocity = 0; // px/ms
    let frame = 0;

    const render = () => {
      frame = 0;
      if (mode !== 'drag') return;
      const has = dx < 0 ? hrefs.current.nextHref : hrefs.current.prevHref;
      // 넘길 탭이 없는 끝은 고무줄처럼 — 멀리 끌수록 덜 따라온다.
      const offset = has ? dx : Math.sign(dx) * Math.min(Math.abs(dx) * 0.3, 60);
      place(offset, 1 - Math.min(Math.abs(offset) / root.clientWidth, 1) * 0.15, 0);
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const ok = e.touches.length === 1 && t && !pending.current && !startsInOwnGesture(e.target, root);
      start = ok ? { x: t.clientX, y: t.clientY } : null;
      mode = ok ? 'undecided' : 'idle';
      dx = 0;
      velocity = 0;
      lastX = t?.clientX ?? 0;
      lastT = e.timeStamp;
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t || mode === 'idle') return;
      dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (mode === 'undecided') {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) mode = 'drag';
        else if (Math.abs(dy) > 10) mode = 'idle'; // 세로 스크롤 — 끝날 때까지 손대지 않는다
        if (mode !== 'drag') return;
      }
      e.preventDefault(); // 가로로 끄는 동안 페이지가 위아래로 같이 흔들리지 않게
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = velocity * 0.4 + ((t.clientX - lastX) / dt) * 0.6;
      lastX = t.clientX;
      lastT = e.timeStamp;
      if (!reduced.matches && !frame) frame = requestAnimationFrame(render);
    };

    const onEnd = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (mode !== 'drag' || !start) {
        start = null;
        mode = 'idle';
        return;
      }
      start = null;
      mode = 'idle';
      const width = root.clientWidth;
      const href = dx < 0 ? hrefs.current.nextHref : hrefs.current.prevHref;
      // 반대 방향으로 튕기며 놓았으면(되돌리려는 손) 거리가 멀어도 넘기지 않는다.
      const flung = Math.abs(velocity) > 0.45 && Math.sign(velocity) === Math.sign(dx);
      const backwards = Math.abs(velocity) > 0.3 && Math.sign(velocity) !== Math.sign(dx);
      const commit = href && !backwards && (Math.abs(dx) > width * 0.3 || (flung && Math.abs(dx) > 30));

      if (!commit) {
        place(0, 1, 320);
        return;
      }
      const dir = dx < 0 ? 1 : -1;
      pending.current = dir;
      if (reduced.matches) {
        router.push(href, { scroll: false });
        return;
      }
      // 남은 거리를 놓은 속도로 가면 걸릴 시간 — 너무 빠르거나 늘어지지 않게 자른다.
      const remain = width - Math.abs(dx);
      const ms = Math.round(Math.min(Math.max(remain / Math.max(Math.abs(velocity), 1.2), 140), 280));
      place(-dir * width, 1, ms);
      // 다 빠져나간 뒤에 주소를 바꾼다 — 나가는 도중에 새 내용이 끼어들어 거꾸로 밀려 나가지 않게.
      window.clearTimeout(fallback.current);
      fallback.current = window.setTimeout(() => {
        router.push(href, { scroll: false });
        // 이동이 실패하거나 너무 늦으면 원래 본문을 되돌려 놓는다.
        fallback.current = window.setTimeout(() => {
          pending.current = 0;
          place(0, 1, 300);
        }, 6000);
      }, ms);
    };

    const onCancel = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (mode === 'drag') place(0, 1, 320);
      start = null;
      mode = 'idle';
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd);
    root.addEventListener('touchcancel', onCancel);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onCancel);
      window.clearTimeout(fallback.current);
    };
  }, [router]);

  return (
    // overflow-x-clip: 밀려난 본문이 페이지에 가로 스크롤을 만들지 않게(스티키 메뉴는 이 바깥이라 영향 없음).
    // 잘리는 선은 화면 끝까지 넓힌다(-mx + px) — 컨테이너 여백 선에서 글자가 뚝 끊겨 보이지 않게.
    <div
      ref={rootRef}
      className="-mx-4 overflow-x-clip px-4 sm:-mx-6 sm:px-6"
      style={{ touchAction: 'pan-y pinch-zoom' }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
