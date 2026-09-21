// 이벤트 미디어 갤러리 — 좌우 스와이프/버튼으로 한 장씩 넘기는 캐러셀.
// 세로로 쌓지 않아 스크롤 압박을 줄인다. 유튜브/인스타/동영상/이미지 자동 렌더.
// 보안: resolveMedia 가 신뢰 도메인 임베드 주소만 생성(임의 iframe src 차단).
'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play, RotateCcw } from 'lucide-react';
import { resolveMedia } from '@123band/shared';
import { storageThumb, storageImageProps } from '@/lib/image';

const VIMEO_ORIGIN = 'https://player.vimeo.com';

// Vimeo 는 임베드 시 가운데 큰 재생버튼을 URL 파라미터로 숨길 수 없다.
// → 클릭 전에는 썸네일만(가운데 버튼 없음), 클릭 시 autoplay 로 재생(사용자 제스처라 소리 O).
// 재생이 끝나면 Vimeo 의 "관련 영상 더 보기" 종료화면을 우리 오버레이로 덮고 "다시 보기"만 노출.
function VimeoFacade({
  id,
  src,
  i,
  replayLabel = 'Replay',
  alt = '',
}: {
  id: string;
  src: string;
  i: number;
  replayLabel?: string;
  alt?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [runId, setRunId] = useState(0); // 다시 보기 시 iframe 재마운트용
  const [thumb, setThumb] = useState<string | null>(null);
  const [ratio, setRatio] = useState<number | null>(null); // 영상 실제 가로/세로 비율
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let alive = true;
    // 공개 oEmbed 로 썸네일 + 실제 비율(width/height)을 가져온다(실패해도 검은 배경/기본비율로 폴백).
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=1280`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        if (d.thumbnail_url) setThumb(d.thumbnail_url as string);
        if (d.width && d.height) setRatio(Number(d.width) / Number(d.height));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  // Vimeo Player postMessage: 준비되면 'ended' 이벤트 구독 → 종료 시 오버레이 표시.
  useEffect(() => {
    if (!playing) return;
    function onMsg(e: MessageEvent) {
      if (e.origin !== VIMEO_ORIGIN || e.source !== iframeRef.current?.contentWindow) return;
      let data: { event?: string };
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.event === 'ready') {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ method: 'addEventListener', value: 'ended' }),
          VIMEO_ORIGIN,
        );
      } else if (data?.event === 'ended') {
        setEnded(true);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [playing]);

  function replay() {
    setEnded(false);
    setRunId((n) => n + 1); // iframe 재마운트 → 처음부터 자동재생
  }

  // 세로 영상: 높이 기준(가운데 정렬, 폭은 비율에서 자동) → 좌우 검은 여백 없음.
  // 가로/정사각: 폭 100%. 비율 로딩 전에는 16:9 로 표시(레이아웃 점프 최소화).
  const portrait = ratio != null && ratio < 1;
  const boxClass = [
    'relative overflow-hidden rounded-xl bg-black',
    ratio == null ? 'aspect-video w-full' : portrait ? 'mx-auto h-[70vh] max-w-full' : 'w-full',
  ].join(' ');
  const boxStyle = ratio != null ? { aspectRatio: String(ratio) } : undefined;

  if (playing) {
    // 재생 중 Vimeo UI 전부 제거: 상단 제목/작성자/프로필(title·byline·portrait=0), 하단 컨트롤바·로고(controls=0).
    return (
      <div className={boxClass} style={boxStyle}>
        <iframe
          key={runId}
          ref={iframeRef}
          src={`${src}?autoplay=1&title=0&byline=0&portrait=0&controls=0`}
          className="h-full w-full"
          title={`media-${i}`}
          allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
        {/* 종료 시: Vimeo 관련영상 화면을 덮고 '다시 보기'만 노출 */}
        {ended && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85">
            <button
              type="button"
              onClick={replay}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-grey-900 shadow-lg transition hover:bg-grey-100"
            >
              <RotateCcw size={18} /> {replayLabel}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label="Play video"
      className={`group flex items-center justify-center ${boxClass}`}
      style={boxStyle}
    >
      {thumb && (
        <Image
          {...storageImageProps(thumb, 1080)}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 800px"
          className="object-cover"
        />
      )}
      {/* 가운데가 아닌 하단 왼쪽에 작은 재생 버튼 (Vimeo 기본 스킨과 유사) */}
      <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/40 backdrop-blur transition group-hover:bg-black/80">
        <Play size={18} className="translate-x-0.5" fill="currentColor" />
      </span>
    </button>
  );
}

function Slide({
  url,
  i,
  replayLabel,
  alt = '',
}: {
  url: string;
  i: number;
  replayLabel?: string;
  alt?: string;
}) {
  const m = resolveMedia(url);
  if (m.kind === 'vimeo' && m.id) {
    return <VimeoFacade id={m.id} src={m.src} i={i} replayLabel={replayLabel} alt={alt} />;
  }
  if (m.kind === 'youtube') {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={m.src}
          className="h-full w-full"
          title={`media-${i}`}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }
  if (m.kind === 'instagram') {
    return (
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-grey-200">
        <iframe src={m.src} className="h-[680px] w-full" title={`media-${i}`} loading="lazy" scrolling="no" />
      </div>
    );
  }
  if (m.kind === 'video') {
    return <video src={m.src} controls className="w-full rounded-xl bg-black" preload="metadata" />;
  }
  // 자유 비율 갤러리 이미지 — next/image 는 비율을 미리 알아야 CLS 방지가 되는데
  // 갤러리 이미지는 원본 비율이 제각각이라 <img>(lazy)로 자연 비율 유지. alt 는 의미있게.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={storageThumb(m.src, 1280)} alt={alt} className="w-full rounded-xl" loading="lazy" />
  );
}

export function MediaGallery({
  items,
  replayLabel,
  alt = '',
}: {
  items?: string[];
  replayLabel?: string;
  alt?: string;
}) {
  const list = (items ?? []).filter((u) => u && u.trim());
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  if (list.length === 0) return null;

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const c = Math.max(0, Math.min(list.length - 1, i));
    el.scrollTo({ left: c * el.clientWidth, behavior: 'smooth' });
  };
  // 스와이프/버튼 어느 쪽이든 현재 위치를 스크롤에서 역산 → 점·버튼·카운터 갱신.
  const onScroll = () => {
    const el = ref.current;
    if (el) setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };
  const many = list.length > 1;

  // 미디어 1개면 캐러셀 없이 그대로.
  if (!many) return <Slide url={list[0]!} i={0} replayLabel={replayLabel} alt={alt} />;

  return (
    <div className="w-full min-w-0">
      <div className="relative">
        {/* 트랙 — 가로 스냅 스크롤(터치 스와이프 네이티브 지원).
            min-w-0: shrink-0 슬라이드의 intrinsic 폭이 상위(그리드/플렉스)를 밀어 페이지가
            가로로 넘치지 않도록 트랙을 부모 폭에 가둔다. */}
        <div
          ref={ref}
          onScroll={onScroll}
          className="flex w-full min-w-0 snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {list.map((url, i) => (
            <div key={i} className="w-full shrink-0 snap-center">
              <Slide url={url} i={i} replayLabel={replayLabel} alt={alt} />
            </div>
          ))}
        </div>

        {/* 좌/우 버튼 — 양 끝에서는 사라짐 */}
        <button
          type="button"
          onClick={() => go(idx - 1)}
          disabled={idx <= 0}
          aria-label="Previous"
          className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/40 backdrop-blur transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => go(idx + 1)}
          disabled={idx >= list.length - 1}
          aria-label="Next"
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/40 backdrop-blur transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronRight size={20} />
        </button>

        {/* 카운터 */}
        <div className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
          {idx + 1} / {list.length}
        </div>
      </div>

      {/* 점 인디케이터 — 클릭 시 해당 장으로 이동 */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {list.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? 'w-6 bg-primary' : 'w-1.5 bg-grey-300 hover:bg-grey-400'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
