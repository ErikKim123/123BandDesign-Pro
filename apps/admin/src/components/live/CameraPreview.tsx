// 스위처 카드 안의 앵글 프리뷰 1칸.
//
// 이 화면의 목적은 '지금 이 앵글에 무엇이 잡혀 있나'를 1초 안에 알아보는 것이다. 방송 품질을
// 판정하는 화면이 아니다. 그래서 소리는 항상 끄고(4칸이 동시에 울면 현장이 무너진다),
// 조작 UI 도 띄우지 않는다 — 카드 전체가 '이 앵글로 전환' 버튼이라 프리뷰가 클릭을 먹으면 안 된다.
//
// 프리뷰가 실패해도 절대 전환을 막지 않는다. 주소가 없거나 재생이 깨지면 그 칸만 회색으로 남고
// 카드의 나머지(번호·이름·ON AIR·전환)는 그대로 살아 있다.
'use client';
import { useEffect, useRef, useState } from 'react';
import { VideoOff } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { parsePreview } from '@/lib/live/preview';

/** HLS — 사파리는 네이티브로 틀고, 나머지 브라우저에서만 hls.js 를 동적으로 받는다(web 쪽과 같은 방식). */
function HlsPreview({ src, onFail }: { src: string; onFail: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    let cancelled = false;
    let destroy: (() => void) | undefined;
    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          video.src = src;
          return;
        }
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) onFail();
        });
        destroy = () => hls.destroy();
      })
      .catch(() => {
        video.src = src;
      });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src, onFail]);

  return <video ref={ref} muted autoPlay playsInline className="h-full w-full object-cover" />;
}

/** 스냅샷(jpg/png) — 그대로 두면 정지 화면이라, 주기적으로 다시 받아 움직이게 한다. */
function SnapshotPreview({ src, onFail }: { src: string; onFail: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);
  const bust = `${src}${src.includes('?') ? '&' : '?'}_=${tick}`;
  // eslint-disable-next-line @next/next/no-img-element -- 현장 스냅샷 주소는 next/image 로 최적화할 대상이 아니다
  return <img src={bust} alt="" onError={onFail} className="h-full w-full object-cover" />;
}

export function CameraPreview({ url }: { url: string | null }) {
  const preview = parsePreview(url);
  const [failed, setFailed] = useState(false);

  // 주소가 바뀌면 실패 표시를 지운다 — 고쳐 넣었는데 계속 회색이면 고친 걸 확인할 방법이 없다.
  useEffect(() => setFailed(false), [url]);

  if (!preview || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-grey-100 text-grey-400">
        <VideoOff size={18} />
        <span className="text-[11px]">
          {failed ? tr('프리뷰 재생 실패') : tr('프리뷰 주소 없음')}
        </span>
      </div>
    );
  }

  // 프리뷰는 눈으로 보는 것 전용 — 포인터 이벤트를 막아 카드의 '전환' 클릭을 가리지 않게 한다.
  return (
    <div className="pointer-events-none h-full w-full bg-ink">
      {preview.kind === 'youtube' && (
        <iframe
          key={preview.src}
          src={preview.src}
          title=""
          allow="autoplay; encrypted-media"
          className="h-full w-full"
        />
      )}
      {preview.kind === 'hls' && <HlsPreview src={preview.src} onFail={() => setFailed(true)} />}
      {(preview.kind === 'video' || preview.kind === 'unknown') && (
        <video
          key={preview.src}
          src={preview.src}
          muted
          autoPlay
          playsInline
          loop
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
      {preview.kind === 'mjpeg' && (
        // eslint-disable-next-line @next/next/no-img-element -- MJPEG 스트림은 next/image 대상이 아니다
        <img src={preview.src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      )}
      {preview.kind === 'snapshot' && (
        <SnapshotPreview src={preview.src} onFail={() => setFailed(true)} />
      )}
    </div>
  );
}
