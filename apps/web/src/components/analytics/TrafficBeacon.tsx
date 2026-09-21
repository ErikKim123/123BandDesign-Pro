// 어드민 방문자수/트래픽수·퍼널분석 메뉴용 페이지뷰 비콘. 렌더 없음(null).
// UTM 은 여기서 직접 읽는다 — Vercel Web Analytics 는 Plus($10/월) 애드온에서만 UTM 을 준다.
//
// 이 파일이 지키는 두 가지.
//
// 1) 화면 한 장 = 기록 한 줄.
//    앱 라우터는 같은 경로에서도 이 컴포넌트를 다시 마운트한다(쿼리스트링만 바뀌는 이동 등).
//    상태를 effect 안에만 두면 그때마다 페이지뷰가 새로 찍혀서, 실제로 /jnj 를 한 번 본 방문이
//    조회 6건으로 부풀고 체류시간은 그만큼 토막났다. 그래서 '지금 보는 화면'을 모듈 스코프에
//    두고, 경로가 실제로 바뀔 때만 새 화면으로 연다. 시간 창(N초 안엔 무시)으로 막지 않는 이유는
//    재마운트 간격이 일정하지 않아서다 — 경로가 그대로면 애초에 떠난 적이 없다.
//
// 2) 체류시간은 '보이던 시간'만 센다(0085).
//    탭을 숨기면 시계를 멈춘다 — 열어두고 자리를 비운 시간이 정독으로 둔갑하지 않게.
//    보내기는 sendBeacon 이다. 떠나는 순간의 fetch 는 문서와 함께 취소될 수 있다.
//    모바일에선 '뒤로/홈'이 unload 없이 숨김으로만 오므로, 숨는 순간에도 보낸다.
'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// 홈화면에 설치된 앱으로 실행됐는지. referrer 만으로는 "직접 접속" 덩어리에 묻혀서
// 설치형 앱 유입을 따로 셀 수 없기 때문에 여기서 구분해 보낸다.
function detectLaunchMode(): string {
  for (const mode of ['standalone', 'fullscreen', 'minimal-ui']) {
    if (window.matchMedia(`(display-mode: ${mode})`).matches) return mode;
  }
  // iOS 사파리의 홈화면 앱은 display-mode 를 주지 않고 navigator.standalone 으로만 알린다.
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return 'standalone';
  return 'browser';
}

// 방문자↔회원 연결은 브라우저 세션당 1회면 충분하다 — 페이지뷰마다 인증 왕복을 붙이지 않는다.
// 로그인 여부 판정은 서버가 한다(여기서 user_id 를 보내지 않는다 — 위조 방지).
const IDENTIFIED_KEY = 'band_identified';

function identifyOnce() {
  try {
    if (sessionStorage.getItem(IDENTIFIED_KEY)) return;
    sessionStorage.setItem(IDENTIFIED_KEY, '1');
  } catch {
    return; // 프라이빗 모드 등 sessionStorage 차단 — 조용히 건너뛴다
  }
  fetch('/api/identify', { method: 'POST', keepalive: true }).catch(() => {});
}

/** 1초 미만은 집계에 넣지 않는다 — 리다이렉트·라우팅 튕김이라 '봤다'고 할 수 없다. */
const MIN_DWELL_MS = 1000;
/** 같은 값을 반복해 보내지 않기 위한 최소 증가폭. */
const RESEND_STEP_MS = 500;

/** 지금 보고 있는 화면 한 장. 재마운트를 건너뛰려면 effect 바깥에 있어야 한다(위 주석 1번). */
interface View {
  path: string;
  /** page_views 행 id. /api/track 응답이 오기 전엔 null 이다. */
  id: number | null;
  /** 보이던 시간 누적(ms) */
  visibleMs: number;
  /** 보이기 시작한 시각. 숨어 있는 동안엔 null 이라 시계가 멈춘다. */
  since: number | null;
  /** 마지막으로 보낸 값 — 줄어든 값이나 같은 값을 다시 보내지 않게 */
  sentMs: number;
}

let view: View | null = null;

function pauseClock(v: View): void {
  if (v.since != null) {
    v.visibleMs += performance.now() - v.since;
    v.since = null;
  }
}

function resumeClock(v: View): void {
  if (v.since == null && !document.hidden) v.since = performance.now();
}

function flush(v: View): void {
  pauseClock(v);
  const ms = Math.round(v.visibleMs);
  // 행 id 를 아직 못 받았거나(응답 전 이탈) 지난번보다 의미 있게 늘지 않았으면 보내지 않는다.
  if (v.id == null || ms < MIN_DWELL_MS || ms <= v.sentMs + RESEND_STEP_MS) return;
  v.sentMs = ms;
  try {
    navigator.sendBeacon(
      '/api/track/dwell',
      new Blob([JSON.stringify({ id: v.id, dwellMs: ms })], { type: 'application/json' }),
    );
  } catch {
    // 비콘이 막힌 브라우저 — 체류시간만 비고 페이지뷰 집계는 그대로다.
  }
}

/** 새 화면을 연다. 페이지뷰를 1건 기록하고, 돌려받은 행 id 를 체류시간 전송에 쓴다. */
function openView(path: string): View {
  const v: View = {
    path,
    id: null,
    visibleMs: 0,
    since: document.hidden ? null : performance.now(),
    sentMs: 0,
  };
  view = v;

  // useSearchParams 대신 location 을 직접 읽는다 — 정적 렌더 페이지에 Suspense 경계를 강요하지 않으려고.
  const q = new URLSearchParams(window.location.search);
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      path,
      referrer: document.referrer || undefined,
      launchMode: detectLaunchMode(),
      utmSource: q.get('utm_source') ?? undefined,
      utmMedium: q.get('utm_medium') ?? undefined,
      utmCampaign: q.get('utm_campaign') ?? undefined,
    }),
  })
    .then((r) => r.json())
    .then((d: { id?: number | null }) => {
      if (typeof d?.id === 'number') v.id = d.id;
    })
    .catch(() => {});

  return v;
}

export function TrafficBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    identifyOnce();

    if (view?.path === pathname) {
      // 같은 화면의 재마운트다. 새로 기록하지 않고 멈춰 있던 시계만 다시 돌린다.
      resumeClock(view);
    } else {
      if (view) flush(view); // 앞 화면을 닫는다
      openView(pathname);
    }

    const v = view!;
    const onVisibility = () => {
      // 모바일은 여기가 사실상 마지막 기회다(pagehide 가 안 오는 경우가 흔하다).
      if (document.hidden) flush(v);
      else resumeClock(v);
    };
    const onHide = () => flush(v);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      // 화면을 떠나거나 재마운트되는 순간. 재마운트라면 다음 effect 가 시계를 이어 돌린다.
      flush(v);
    };
  }, [pathname]);

  return null;
}
