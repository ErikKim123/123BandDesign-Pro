// 라이브 섹션의 '진행 대시보드' — 현장 스크린에 띄우는 진행 상태 화면(라운드·단계)을
// 온라인 시청자에게도 그대로 보여준다.
//
// 왜 필요한가: 현장 관객은 무대 스크린으로 "지금 세미파이널 준비 중"을 읽는다. 온라인은
// 유튜브 화면뿐이라, 방송이 잠시 멈춘 구간에서는 무슨 일이 벌어지는지 알 길이 없었다.
//
// 왜 iframe 인가: 대시보드는 이 레포가 아닌 별도 앱이다. 화면을 이쪽에 다시 만들면 두 벌을
// 따로 고쳐야 하고, 현장에서 바뀐 내용이 여기로 안 넘어온다. 남의 화면을 그대로 데려온다.
'use client';
import { useEffect, useMemo, useState } from 'react';
import { pickI18n, type Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { LiveBroadcast } from '@/lib/queries/live';

/**
 * 시청자에게 보여줄 때 늘 붙는 파라미터.
 *
 *   display=1 — 표출 모드. 안 붙이면 운영자 화면(조회·MC·라운드 버튼이 늘어선 콘솔)이 그대로
 *               나온다. 시청자에게 필요한 건 결과판이지 조작판이 아니다.
 *   follow=1  — MC 따라가기. 대시보드는 지금 보는 화면을 주소(round·step)로 정하는 앱이라,
 *               이걸 안 붙이면 프레임이 처음 주소에 멈춘 채 현장이 아무리 넘어가도 그대로다.
 *               '모니터링'이 되려면 현장을 따라와야 한다.
 *
 * 어드민이 주소에 직접 값을 넣었으면 그쪽을 존중한다 — 일부러 끈 것을 코드가 되돌리지 않는다.
 */
const VIEWER_PARAMS: Record<string, string> = { display: '1', follow: '1' };

function toViewerUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    for (const [key, value] of Object.entries(VIEWER_PARAMS)) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    // 주소가 망가졌으면 프레임을 띄우지 않는다 — 어드민 저장 때 걸러지지만, 여기서도 막는다.
    return null;
  }
}

export function LiveDashboardFrame({
  live,
  locale,
  dict,
}: {
  live: LiveBroadcast;
  locale: Locale;
  dict: Dictionary;
}) {
  // 새로고침은 src 에 파라미터를 붙이는 대신 프레임을 다시 그려서 한다 —
  // 대시보드는 주소(round·step)로 화면을 정하는 앱이라, 우리가 파라미터를 얹으면
  // 남의 화면 규칙에 손대는 꼴이 된다. key 만 바꾸면 같은 주소를 새로 불러온다.
  const [nonce, setNonce] = useState(0);
  const url = useMemo(
    () => (live.dashboard_url ? toViewerUrl(live.dashboard_url) : null),
    [live.dashboard_url],
  );
  const every = live.dashboard_refresh_sec;

  useEffect(() => {
    if (!url || every <= 0) return;
    const timer = setInterval(() => {
      // 안 보고 있는 탭까지 남의 서버를 두드릴 이유가 없다 — 돌아오면 그때 맞춘다.
      if (document.visibilityState === 'visible') setNonce((n) => n + 1);
    }, every * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, every]);

  // 스위치를 껐거나 주소가 없으면 자리도 남기지 않는다 — 라이브 섹션과 같은 규칙.
  if (!url || !live.show_dashboard) return null;

  const label = pickI18n(live.dashboard_label_i18n, locale) || dict.live.dashboardTitle;

  return (
    <div className="mt-4">
      <p className="label-caps mb-2 text-primary">{label}</p>
      {/* 보기만 하는 화면이다. 대시보드에는 운영자용 조작(라운드 전환·새로고침·종료)이
          같이 들어 있어, 시청자의 클릭이 닿으면 현장 화면을 건드리게 된다.
          pointer-events 를 끊어 '띄워 놓은 스크린'으로만 만든다.
          sandbox 는 최소 권한만 — 스크립트는 화면이 그려지려면 필요하고, 팝업·폼 전송·
          상위 프레임 이동은 남의 화면에 내줄 이유가 없다. */}
      <div className="pointer-events-none aspect-video w-full overflow-hidden rounded-lg border border-grey-200 bg-ink">
        <iframe
          key={nonce}
          title={label}
          src={url}
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
      <p className="mt-2 text-[11px] text-grey-400">{dict.live.dashboardHint}</p>
    </div>
  );
}
