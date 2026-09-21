// 라이브 플레이어 — 소스 종류로만 분기한다(youtube | hls).
//
// 나중에 유튜브를 걷어내고 Cloudflare Stream 으로 옮겨도 이 파일의 분기만 늘리면 되도록,
// 바깥(페이지·라우팅·DB)은 '소스 타입' 이상을 알지 못하게 막아 둔다.
'use client';
import { useEffect, useRef, useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';

/** HLS 재생 — 사파리는 네이티브로 틀고, 나머지 브라우저에서만 hls.js 를 동적으로 불러온다. */
function HlsVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let destroy: (() => void) | undefined;

    // 사파리/iOS 는 m3u8 을 그대로 재생한다 — 이 경우 라이브러리를 아예 받지 않는다.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    let cancelled = false;
    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(src);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      })
      .catch(() => {
        // 로드 실패 시에는 네이티브 재생을 한 번 시도해 본다(그래도 안 되면 브라우저가 안내한다).
        video.src = src;
      });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      controls
      autoPlay
      playsInline
      aria-label={label}
      className="h-full w-full bg-ink"
    />
  );
}

export function LivePlayer({
  source,
  ytVideoId,
  hlsUrl,
  title,
  dict,
}: {
  source: 'youtube' | 'backup';
  ytVideoId: string | null;
  hlsUrl: string | null;
  title: string;
  dict: Dictionary;
}) {
  // 임베드가 뜨기 전 검은 상자 대신 회색 판을 깔아 둔다(레이아웃이 흔들리지 않게 비율은 고정).
  const [loaded, setLoaded] = useState(false);
  const usable = source === 'youtube' ? !!ytVideoId : !!hlsUrl;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-grey-200 bg-grey-100">
      {!usable && (
        <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-grey-500">
          {dict.live.playerUnavailable}
        </div>
      )}

      {usable && source === 'youtube' && ytVideoId && (
        <>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-grey-500">
              {dict.live.playerLoading}
            </div>
          )}
          <iframe
            // 영상이 바뀌면 key 가 바뀌어 강제로 다시 붙는다(관리자가 방송 중에 영상을 갈아끼우는 경우).
            key={ytVideoId}
            src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={title}
            onLoad={() => setLoaded(true)}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full"
          />
        </>
      )}

      {usable && source === 'backup' && hlsUrl && <HlsVideo src={hlsUrl} label={title} />}
    </div>
  );
}
