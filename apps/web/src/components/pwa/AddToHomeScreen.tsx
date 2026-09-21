// 헤더/드로어 버튼 — 기기 배치에 따라 분기.
// · PC(헤더 아이콘, variant='icon'): '북마크' — 클릭 시 안내 모달을 띄운다. 모달의 '북마크 하기' 버튼은
//   레거시 API(구형 IE/FF)로 등록을 '시도'하고, 최신 브라우저가 막으면(=대부분) Ctrl+D(⌘+D) 키를
//   크게 강조해 직접 누르도록 안내한다. (브라우저는 웹사이트의 북마크 자동추가를 원천 차단한다.)
// · 모바일(드로어 행, variant='row'): '홈 화면에 추가' — beforeinstallprompt 설치 / iOS 안내 시트.
'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookmarkPlus, Ellipsis, Share, Star, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type A2hsLabels = {
  /** 모바일(드로어 행) 버튼 라벨 — 홈 화면에 추가 */
  button: string;
  /** PC(헤더 아이콘) 버튼 라벨 — 북마크에 추가 (aria) */
  bookmarkButton: string;
  /** 북마크 모달 제목 */
  bookmarkTitle: string;
  /** 북마크 모달 안내 문구 */
  bookmarkHint: string;
  /** 북마크 모달 실행 버튼 */
  bookmarkDo: string;
  /** 버튼 자동추가 차단 시 안내 (키를 직접 누르라는 문구) */
  bookmarkBlocked: string;
  /** 레거시 등록 성공 토스트 */
  bookmarkDone: string;
  /** 모바일 설치 안내 토스트 (+ iOS 시트) */
  added: string;
  /** 모바일 설치 프롬프트 미발화 폴백 토스트 */
  manual: string;
  iosTitle: string;
  iosStep1: string;
  iosStep2: string;
  /** iOS 비(非)Safari(크롬 등) — 북마크 안내 (홈 화면 추가는 Safari 전용) */
  iosBmTitle: string;
  iosBmStep1: string;
  iosBmStep2: string;
  iosBmDone: string;
  close: string;
};

export function AddToHomeScreen({
  labels,
  variant = 'icon',
  mode = 'bookmark',
  onActivate,
}: {
  labels: A2hsLabels;
  /** 시각 형태: 'icon' = 링 아이콘 버튼(아이콘만), 'row' = 전체폭 메뉴 행(아이콘+텍스트) */
  variant?: 'icon' | 'row';
  /** 동작: 'bookmark' = 북마크 안내 모달(PC), 'install' = 홈 화면에 추가/설치(모바일) */
  mode?: 'bookmark' | 'install';
  /** 클릭 시 최초에 호출 (예: 드로어 닫기) */
  onActivate?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [iosSheet, setIosSheet] = useState<null | 'home' | 'bookmark'>(null);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [bookmarkBlocked, setBookmarkBlocked] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    setIsMac(/Macintosh|Mac OS X/i.test(navigator.userAgent));
  }, []);

  // 이미 설치(standalone)로 실행 중이면 (모바일에서) 버튼 숨김
  useEffect(() => {
    const nav = window.navigator as unknown as { standalone?: boolean };
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
    if (standalone) setInstalled(true);
  }, []);

  // 서비스워커 등록 → (모바일) 설치 프롬프트 발화 조건 충족
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // 설치 프롬프트 캐치 + 설치완료 감지
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const flashToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3400);
  };

  // 레거시 북마크 API(구형 IE/FF)만 존재 → 최신 브라우저에선 대부분 no-op. 성공 시 true.
  const tryLegacyBookmark = (): boolean => {
    try {
      const w = window as unknown as {
        external?: { AddFavorite?: (u: string, t: string) => void };
        sidebar?: { addPanel?: (t: string, u: string, e: string) => void };
      };
      if (w.external && typeof w.external.AddFavorite === 'function') {
        w.external.AddFavorite(location.href, document.title);
        return true;
      }
      if (w.sidebar && typeof w.sidebar.addPanel === 'function') {
        w.sidebar.addPanel(document.title, location.href, '');
        return true;
      }
    } catch {
      /* noop */
    }
    return false;
  };

  // 모달의 '북마크 하기' — 레거시로 시도, 막히면 키 강조 안내
  const doBookmark = () => {
    if (tryLegacyBookmark()) {
      setBookmarkOpen(false);
      flashToast(labels.bookmarkDone);
      return;
    }
    setBookmarkBlocked(true);
  };

  const handleClick = async () => {
    onActivate?.();
    // 북마크 모드(PC) — 안내 모달
    if (mode === 'bookmark') {
      setBookmarkBlocked(false);
      setBookmarkOpen(true);
      return;
    }
    // 설치 모드(모바일) — 홈 화면에 추가
    if (deferred) {
      flashToast(labels.added);
      await deferred.prompt();
      try {
        const choice = await deferred.userChoice;
        if (choice.outcome !== 'accepted') setToast(null);
      } catch {
        /* noop */
      }
      setDeferred(null);
      return;
    }
    // iOS — 홈 화면 추가는 Safari 전용. Safari면 홈추가 안내, 크롬 등이면 북마크 안내.
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) {
      const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
      setIosSheet(isSafari ? 'home' : 'bookmark');
      return;
    }
    flashToast(labels.manual);
  };

  if (installed) return null;

  const label = mode === 'bookmark' ? labels.bookmarkButton : labels.button;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <>
      {variant === 'row' ? (
        // 모바일 드로어용 — 전체폭 메뉴 행(아이콘 + 텍스트)
        <button
          type="button"
          onClick={handleClick}
          aria-label={label}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-grey-800 transition-colors hover:bg-grey-50 hover:text-primary"
        >
          <BookmarkPlus size={20} strokeWidth={2.2} className="text-primary" />
          <span>{label}</span>
        </button>
      ) : (
        // 헤더용 — 링 아이콘 버튼
        <button
          type="button"
          onClick={handleClick}
          aria-label={label}
          title={label}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/50 bg-white text-primary shadow-sm transition-colors duration-200 hover:bg-primary hover:text-white"
        >
          {/* 신규 기능 주목용 은은한 링 펄스(3회 후 정지) */}
          <span
            aria-hidden
            className="a2hs-pulse pointer-events-none absolute inset-0 rounded-full border-2 border-primary/60"
          />
          <BookmarkPlus size={15} strokeWidth={2.4} />
        </button>
      )}

      {/* PC 북마크 안내 모달 */}
      {mounted &&
        bookmarkOpen &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div
              aria-hidden
              onClick={() => setBookmarkOpen(false)}
              className="absolute inset-0 bg-black/50"
            />
            <div
              role="dialog"
              aria-modal="true"
              className="a2hs-toast-in relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setBookmarkOpen(false)}
                aria-label={labels.close}
                className="absolute right-3 top-3 p-1 text-grey-400 transition-colors hover:text-ink"
              >
                <X size={20} />
              </button>

              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream text-primary">
                <BookmarkPlus size={24} strokeWidth={2.2} />
              </span>
              <h2 className="text-lg font-bold text-ink">{labels.bookmarkTitle}</h2>
              <p className="mx-auto mt-1.5 max-w-[19rem] text-sm text-grey-500">{labels.bookmarkHint}</p>

              {/* 단축키 칩 — 막히면 강조(ring) */}
              <div
                className={`mx-auto mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-3 transition-all ${
                  bookmarkBlocked ? 'bg-primary/5 ring-2 ring-primary' : 'bg-grey-50'
                }`}
              >
                <kbd className="inline-flex min-w-[2.75rem] items-center justify-center rounded-lg border border-grey-300 border-b-[3px] bg-white px-3 py-2 font-mono text-base font-bold text-ink">
                  {modKey}
                </kbd>
                <span className="text-lg font-semibold text-grey-400">+</span>
                <kbd className="inline-flex min-w-[2.75rem] items-center justify-center rounded-lg border border-grey-300 border-b-[3px] bg-white px-3 py-2 font-mono text-base font-bold text-ink">
                  D
                </kbd>
              </div>

              {bookmarkBlocked && (
                <p className="mx-auto mt-3 max-w-[19rem] text-sm font-medium text-primary">
                  {labels.bookmarkBlocked}
                </p>
              )}

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setBookmarkOpen(false)} className="btn btn-secondary flex-1">
                  {labels.close}
                </button>
                <button type="button" onClick={doBookmark} className="btn btn-primary flex-1 gap-1.5">
                  <BookmarkPlus size={16} /> {labels.bookmarkDo}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 안내 토스트 (하단 중앙) */}
      {mounted &&
        toast &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
            <div className="a2hs-toast-in pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-2">
              <BookmarkPlus size={16} className="text-sunshine-500" />
              <span>{toast}</span>
            </div>
          </div>,
          document.body,
        )}

      {/* iOS 안내 시트 — Safari=홈 화면 추가, 크롬 등=북마크 */}
      {mounted &&
        iosSheet &&
        createPortal(
          <div className="fixed inset-0 z-[90]">
            <div
              aria-hidden
              onClick={() => setIosSheet(null)}
              className="absolute inset-0 bg-black/50"
            />
            <div
              role="dialog"
              aria-modal="true"
              className="a2hs-sheet-in absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-5 pb-8 shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-grey-200" />
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary/50 text-primary">
                    <BookmarkPlus size={15} strokeWidth={2.4} />
                  </span>
                  {iosSheet === 'home' ? labels.iosTitle : labels.iosBmTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setIosSheet(null)}
                  aria-label={labels.close}
                  className="-mr-1 p-1 text-grey-500 transition-colors hover:text-ink"
                >
                  <X size={20} />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-grey-700">
                <li className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream text-xs font-bold text-primary">
                    1
                  </span>
                  <span className="flex items-center gap-1.5">
                    {iosSheet === 'home' ? labels.iosStep1 : labels.iosBmStep1}
                    {iosSheet === 'home' ? (
                      <Share size={16} className="text-info" />
                    ) : (
                      <Ellipsis size={16} className="text-grey-500" />
                    )}
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream text-xs font-bold text-primary">
                    2
                  </span>
                  <span className="flex items-center gap-1.5">
                    {iosSheet === 'home' ? labels.iosStep2 : labels.iosBmStep2}
                    {iosSheet === 'bookmark' && <Star size={16} className="text-sunshine-500" />}
                  </span>
                </li>
              </ol>
              <p className="mt-4 rounded-lg bg-grey-50 px-3 py-2.5 text-center text-sm font-medium text-ink">
                {iosSheet === 'home' ? labels.added : labels.iosBmDone}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
