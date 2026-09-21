// J&J 대회 화면의 라이브 섹션 알맹이 — 시청 페이지로 보내지 않고 그 자리에서 방송을 튼다.
//
// 왜 클라이언트인가: 방송은 보고 있는 중에 끝난다. 서버가 그린 그대로 두면 방송이 끝나도
// 새로고침 전까지 죽은 플레이어가 남는다. 그래서 방송을 따라간다 —
// 1순위 Realtime(postgres_changes), 2순위 30초 폴링. 상태가 '방송중'을 벗어나면 스스로 사라진다.
'use client';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { useCallback, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { LiveBroadcast } from '@/lib/queries/live';
import { createClient } from '@/lib/supabase/client';
import { LiveDashboardFrame } from './LiveDashboardFrame';
import { LivePlayer } from './LivePlayer';
import { useEmbedDomain } from './useEmbedDomain';

const COLS =
  'id, slug, event_product_id, jnj_edition_id, jnj_division_id, title_i18n, yt_video_id, backup_hls_url, active_source, status, scheduled_at, show_chat, notice_i18n, dashboard_url, show_dashboard, dashboard_label_i18n, dashboard_refresh_sec, started_at, updated_at';

export function JnjLiveEmbed({
  initial,
  locale,
  dict,
}: {
  initial: LiveBroadcast;
  locale: Locale;
  dict: Dictionary;
}) {
  const [b, setB] = useState<LiveBroadcast>(initial);
  const [chatOpen, setChatOpen] = useState(false);
  const embedDomain = useEmbedDomain();

  // 상단 배너(#live)로 들어오면 그 자리로 데려간다.
  // 브라우저의 앵커 이동은 이 카드가 하이드레이션되며 커지기 전에 끝나 버려서, 그대로 두면
  // 페이지 맨 위에 멈춘 것처럼 보인다. 그려진 뒤 한 번 더 맞춘다(scroll-mt 로 헤더는 피한다).
  useEffect(() => {
    if (window.location.hash !== '#live') return;
    const timer = setTimeout(() => {
      document.getElementById('live')?.scrollIntoView({ block: 'start' });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const refetch = useCallback(async () => {
    const { data } = await createClient()
      .from('live_broadcasts')
      .select(COLS)
      .eq('id', initial.id)
      .maybeSingle();
    // 못 읽으면(RLS·네트워크) 보고 있는 화면을 그대로 둔다 — 빈 화면으로 떨어뜨리지 않는다.
    if (data) setB(data as unknown as LiveBroadcast);
  }, [initial.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`jnj-live-${initial.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: DB_SCHEMA,
          table: 'live_broadcasts',
          filter: `id=eq.${initial.id}`,
        },
        () => void refetch(),
      )
      .subscribe();

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void refetch();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [initial.id, refetch]);

  // 끝난 방송은 자리도 남기지 않는다 — 이 섹션은 '지금 하고 있다'는 뜻이다.
  if (b.status !== 'live') return null;

  const title = pickI18n(b.title_i18n, locale);
  const notice = pickI18n(b.notice_i18n, locale);
  // 채팅은 유튜브 소스일 때만. 백업(HLS)에는 채팅이 없다 — 시청 페이지와 같은 규칙.
  const showChat = b.show_chat && b.active_source === 'youtube' && !!b.yt_video_id;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-primary bg-cream-light">
      <div className="h-1 bg-gradient-to-r from-primary to-primary-deep" />
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {/* 대회명 아래 CTA(.live-cta)와 같은 연출 — 같은 방송을 가리키는 표시가 화면 안에서
              두 얼굴이면 둘 다 흐려진다. 여기선 누를 것이 없어 배지 변형을 쓴다. */}
          <span className="live-cta live-cta--badge">
            <span className="live-cta__sheen" aria-hidden />
            <span className="live-cta__dot" aria-hidden />
            {dict.live.jnjBadge}
          </span>
          <p className="font-display text-lg font-extrabold text-ink sm:text-xl">{title}</p>
          {b.active_source === 'backup' && (
            <span className="rounded-pill bg-cream px-3 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-primary">
              {dict.live.backupBadge}
            </span>
          )}
        </div>

        {notice && (
          <div className="mb-4 rounded-lg border border-beige bg-white px-4 py-3 text-sm text-grey-800">
            <span className="label-caps mr-2 text-primary">{dict.live.notice}</span>
            {notice}
          </div>
        )}

        <div className={showChat ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]' : ''}>
          <div className="min-w-0">
            <LivePlayer
              source={b.active_source}
              ytVideoId={b.yt_video_id}
              hlsUrl={b.backup_hls_url}
              title={title}
              dict={dict}
            />
            {b.active_source === 'backup' && b.show_chat && (
              <p className="mt-3 text-sm text-grey-500">{dict.live.chatUnavailable}</p>
            )}
          </div>

          {showChat && (
            <div className="min-w-0">
              {/* 대회 페이지 안이라 채팅은 접힌 채로 시작한다 — 펼치면 아래 섹션들이 그만큼 밀린다.
                  넓은 화면에서는 영상 옆이라 밀 것이 없어 늘 펼쳐 둔다. */}
              <button
                type="button"
                onClick={() => setChatOpen((v) => !v)}
                className="btn btn-secondary btn-sm mb-2 w-full lg:hidden"
              >
                <MessageSquare size={15} />
                {chatOpen ? dict.live.chatHide : dict.live.chatShow}
              </button>
              <div
                className={`${chatOpen ? 'block' : 'hidden'} h-[380px] overflow-hidden rounded-lg border border-grey-200 bg-grey-100 lg:block lg:h-full lg:min-h-[420px]`}
              >
                {embedDomain && (
                  <iframe
                    key={`${b.yt_video_id}-${embedDomain}`}
                    title={dict.live.chatTitle}
                    src={`https://www.youtube.com/live_chat?v=${b.yt_video_id}&embed_domain=${embedDomain}`}
                    className="h-full w-full"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* 진행 대시보드는 채팅 칸까지 넘어 카드 전체 폭을 쓴다.
            영상 칸 안에 두면 리더/팔로워 점수표가 한 줄에 안 들어가 글씨가 뭉개지고 프레임에
            스크롤이 생긴다 — 읽으라고 띄운 화면이 읽히지 않는다. 가로로 넓은 표는 넓게 둔다. */}
        <LiveDashboardFrame live={b} locale={locale} dict={dict} />
      </div>
    </div>
  );
}
