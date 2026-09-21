// 운영자 알림 수신 — 헤더의 종(안읽음 배지) + 화면 위에서 내려오는 알림 배너 + 홈 화면 아이콘 배지.
//
// 헤더에 두는 이유: 알림은 어느 화면에서 받든 그 자리에서 보여야 한다. 헤더는 모든 페이지에
// 있으므로 여기 한 번만 붙이면 사이트 전체가 수신 상태가 된다.
//
// 즉시 반영 경로가 두 겹인 것은 소셜 알림(NotifySettings)과 같은 이유다:
//   1) Realtime — 정상 경로. INSERT 를 받으면 곧바로 카드 + 소리.
//   2) 폴링(25초) — RLS 테이블의 postgres_changes 는 realtime 이 JWT 를 못 받으면 조용히
//      아무것도 안 온다. 그 경우 새로고침 전까지 영영 안 보이므로 안전망을 둔다.
//      탭이 백그라운드면 쉰다.
'use client';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { buzzNotice, playNoticeSound } from './sound';
import { localizeNotice } from './localize';
import { NOTICES_READ_EVENT } from './events';

export interface NoticeStrings {
  title: string;
  new: string;
  now: string;
  open: string;
  close: string;
  seeAll: string;
}

export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  /** 왼쪽 아이콘(뱃지 이미지 등, 0107). 없으면 123Band 로고. */
  icon_url: string | null;
  /** 영어 판(0109). 사이트 언어가 EN 이고 둘 다 있으면 이걸 보여 준다. */
  title_en: string | null;
  body_en: string | null;
  created_at: string;
}

const COLS = 'id, title, body, title_en, body_en, link_url, icon_url, created_at';
/** 한 번에 쌓아 두는 카드 수 — 넘치면 오래된 것부터 밀어낸다(화면을 덮지 않게). */
const MAX_CARDS = 3;
/** 배너가 스스로 사라지기까지(ms). 사라져도 종 배지와 알림함에 그대로 남아 잃는 정보는 없다. */
const AUTO_DISMISS_MS = 8_000;
/** 위로 이만큼 밀어 올리면 닫는다(px) — 아이폰 알림을 걷어내는 동작 그대로. */
const SWIPE_CLOSE_PX = 44;

export function NoticeCenter({
  locale,
  isAuthed,
  t,
}: {
  locale: string;
  isAuthed: boolean;
  t: NoticeStrings;
}) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [cards, setCards] = useState<NoticeRow[]>([]);
  // 카드는 body 로 내보낸다(아래 주석) — 서버 렌더에는 document 가 없으므로 마운트 후에만.
  const [mounted, setMounted] = useState(false);
  // 이미 띄운 알림 — Realtime 과 폴링이 같은 행을 두 번 물어와도 카드는 한 장만 뜬다.
  const seenRef = useRef<Set<string>>(new Set());
  const inboxHref = `/${locale}/account/notices`;

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const show = useCallback((rows: NoticeRow[]) => {
    const fresh = rows.filter((r) => !seenRef.current.has(r.id));
    if (fresh.length === 0) return;
    for (const r of fresh) seenRef.current.add(r.id);
    setCards((prev) => [...fresh, ...prev].slice(0, MAX_CARDS));
    playNoticeSound();
    buzzNotice();
  }, []);

  const refreshUnread = useCallback(async () => {
    const { data } = await createClient().rpc('my_unread_notices');
    if (typeof data === 'number') setUnread(data);
  }, []);

  // 안읽음 개수 — 진입 시 1회. 알림함을 보고 나오면 0 이 되어야 하므로 경로가 바뀔 때마다 다시 센다.
  useEffect(() => {
    if (!isAuthed) return;
    void refreshUnread();
  }, [isAuthed, pathname, refreshUnread]);

  // 알림함이 읽음 처리를 끝내면 그 자리에서 0 으로 — 경로 변화만 보고 있으면 다 읽은 뒤에도
  // 다음 이동 전까지 숫자가 남는다.
  useEffect(() => {
    const onRead = () => {
      setUnread(0);
      // 폰 알림창에 남은 공지 알림도 닫는다 — 안드로이드 런처는 떠 있는 알림 수로 아이콘 숫자를 매겨서,
      // 사이트에서 다 읽어도 알림이 남아 있으면 아이콘 숫자가 그대로 남는다.
      void navigator.serviceWorker?.getRegistration().then((reg) =>
        reg?.getNotifications().then((list) =>
          list.filter((n) => n.tag.startsWith('band-notice')).forEach((n) => n.close()),
        ),
      ).catch(() => {
        /* 알림 정리는 덤이다 */
      });
    };
    window.addEventListener(NOTICES_READ_EVENT, onRead);
    return () => window.removeEventListener(NOTICES_READ_EVENT, onRead);
  }, []);

  // 홈 화면 아이콘 배지 — 설치해서 쓰는(PWA) 회원의 아이콘에 안읽음 수를 얹는다.
  // 앱이 닫혀 있는 동안 온 알림은 서비스워커가 얹고, 열려 있는 동안은 여기서 맞춘다.
  // 지원하지 않는 브라우저(대부분의 데스크톱 탭)에서는 아무 일도 일어나지 않는다.
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    // 로그아웃 상태의 남은 배지도 지운다 — 남의 숫자가 아이콘에 남아 있으면 안 된다.
    const done = isAuthed && unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge?.();
    done?.catch(() => {
      /* 배지는 덤이다 — 실패해도 알림 자체에는 영향이 없다 */
    });
  }, [isAuthed, unread]);

  // Realtime — 내 알림 INSERT 만 받는다(필터 + RLS 이중).
  useEffect(() => {
    if (!isAuthed) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      // RLS 테이블의 postgres_changes 는 소켓이 사용자 JWT 를 알아야 행을 흘려보낸다.
      if (session.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel('member-notices-me')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: DB_SCHEMA,
            table: 'member_notices',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            show([payload.new as NoticeRow]);
            setUnread((n) => n + 1);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [isAuthed, show]);

  // 폴백 폴링 — Realtime 이 막힌 망에서도 25초 안에는 뜬다.
  useEffect(() => {
    if (!isAuthed) return;
    const supabase = createClient();
    // 처음 한 바퀴는 접속한 시각 이후만 본다 — 예전에 안 읽은 알림이 방문할 때마다 카드로
    // 쏟아지지 않게. 그건 종 배지와 알림함이 맡는다.
    let since = new Date().toISOString();

    async function poll() {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase
        .from('member_notices')
        .select(COLS)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(MAX_CARDS);
      const rows = (data ?? []) as NoticeRow[];
      const newest = rows[0];
      if (newest) {
        since = newest.created_at;
        show(rows);
        void refreshUnread();
      }
    }

    const timer = setInterval(() => void poll(), 25_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthed, show, refreshUnread]);

  if (!isAuthed) return null;

  return (
    <>
      <Link
        href={inboxHref}
        className="relative p-1 text-grey-700 transition-colors hover:text-primary"
        aria-label={t.title}
        title={t.title}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Link>

      {/* 알림 배너 — 아이폰 알림처럼 화면 위에서 내려온다(모바일은 전체 폭, PC 는 오른쪽 위).
          제목만 보여준다: 배너는 '무엇이 왔는지'만 알리는 자리고, 내용은 눌러서 본다.
          8초 뒤 스스로 사라지고, 사라져도 종 배지와 알림함에는 그대로 남는다.

          body 로 포탈하는 이유: 헤더에 backdrop-blur 가 걸리면 그 헤더가 자손 fixed 의 기준
          (containing block)이 된다. 그대로 두면 bottom-3 이 뷰포트가 아니라 헤더 밑변 기준이
          되어 카드가 화면 위로 잘리고, 잘린 자리에 있는 닫기 버튼을 누를 수 없다. */}
      {mounted &&
        cards.length > 0 &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-2 top-2 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-3 sm:top-3 sm:w-[380px]">
            {cards.map((c) => (
              <NoticeCard
                key={c.id}
                notice={c}
                inboxHref={inboxHref}
                locale={locale}
                t={t}
                onDismiss={dismiss}
              />
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * 알림 배너 한 장 — 아이폰 알림과 같은 모양이다.
 * 앱 아이콘 · 제목 한 줄 · 받은 시각, 그리고 배너 전체가 누르는 자리다.
 *
 * 제목만 두는 이유: 배너는 '무엇이 왔는지'만 알리는 자리다. 본문까지 얹으면 화면을 그만큼
 * 더 가리는데, 정작 내용은 눌러서 알림함(또는 링크)에서 보게 된다.
 *
 * 사라지는 시계를 각자 들고 있어서 먼저 온 알림이 먼저 사라진다.
 */
function NoticeCard({
  notice,
  inboxHref,
  locale,
  t,
  onDismiss,
}: {
  notice: NoticeRow;
  inboxHref: string;
  locale: string;
  t: NoticeStrings;
  onDismiss: (id: string) => void;
}) {
  // 시계를 멈추는 두 가지 — 읽는 중(마우스·포커스)과 탭이 뒤에 있을 때.
  // 안 보고 있는 사이에 8초가 흘러 사라지면 자동 사라짐이 '못 보고 놓침'이 된다.
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(false);
  // 위로 미는 중의 이동량. 아이폰에서 알림을 걷어내는 그 동작이다.
  const [swipe, setSwipe] = useState(0);
  const swipeFrom = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => setHidden(document.visibilityState !== 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    if (held || hidden) return;
    // 멈췄다 다시 흐를 때는 8초를 처음부터 — 읽다 만 배너에 남은 1초를 주지 않으려고.
    const timer = setTimeout(() => onDismiss(notice.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [held, hidden, notice.id, onDismiss]);

  return (
    <article
      role="status"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        if (!touch) return;
        swipeFrom.current = touch.clientY;
        setHeld(true);
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        const from = swipeFrom.current;
        if (!touch || from === null) return;
        // 위로 미는 것만 따라간다 — 아래로 당기면 페이지가 스크롤되는 게 자연스럽다.
        setSwipe(Math.min(0, touch.clientY - from));
      }}
      onTouchEnd={() => {
        swipeFrom.current = null;
        if (swipe <= -SWIPE_CLOSE_PX) onDismiss(notice.id);
        else {
          setSwipe(0);
          setHeld(false);
        }
      }}
      // 밀다가 손을 떼면 링크가 열리면 안 된다 — 민 거리가 남아 있으면 클릭을 삼킨다.
      onClickCapture={(e) => {
        if (swipe !== 0) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={swipe ? { transform: `translateY(${swipe}px)`, transition: 'none' } : undefined}
      // 흰 배너가 흰 화면 위에 뜨면 경계가 안 보인다. 테두리만 오렌지로 세우고 바탕은
      // 흰색 그대로 둔다 — 배너 전체를 색으로 채우면 아이폰 알림과 멀어진다.
      className="notice-banner-in group pointer-events-auto relative overflow-hidden rounded-[22px] border-[1.5px] border-primary/70 bg-white/90 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)] backdrop-blur-xl"
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        {/* 업적 알림이면 그 뱃지가, 운영자 공지면 123Band 로고가 앱 아이콘 자리에 온다. 뱃지는
            투명 배경의 원형 그림이라 자르지 않고(contain) 그대로 보인다. */}
        {notice.icon_url ? (
          <Image
            src={notice.icon_url}
            alt=""
            width={38}
            height={38}
            unoptimized
            className="h-[38px] w-[38px] shrink-0 object-contain"
          />
        ) : (
          <Image
            src="/wolf-mark.png"
            alt=""
            width={38}
            height={38}
            className="h-[38px] w-[38px] shrink-0 rounded-[9px] object-cover"
          />
        )}
        {/* 제목 한 줄. 길면 말줄임 — 두 줄로 불어나면 배너가 아이폰 것보다 커진다. */}
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-ink">
          {localizeNotice(notice, locale).title}
        </p>
        {/* 받은 시각 자리. 마우스를 올리면 그 자리에 닫기가 나온다(맥 알림과 같은 방식) —
            늘 보이는 X 는 아이폰 알림에 없는 것이라 평소에는 감춘다. */}
        <span className="relative flex h-6 w-11 shrink-0 items-center justify-end">
          <span className="text-[13px] text-grey-500 transition-opacity group-hover:opacity-0">
            {t.now}
          </span>
          <button
            type="button"
            onClick={() => onDismiss(notice.id)}
            aria-label={t.close}
            className="absolute right-0 z-20 rounded-full bg-grey-200/90 p-1 text-grey-700 opacity-0 transition-opacity hover:bg-grey-300 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X size={13} />
          </button>
        </span>
      </div>
      {/* 배너 전체가 누르는 자리다 — 아이폰 알림처럼 어디를 눌러도 열린다.
          링크가 있으면 그리로, 없으면 알림함으로. 버튼(z-20)보다 아래에 깔린다. */}
      {notice.link_url ? (
        <a
          href={notice.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-10"
        >
          <span className="sr-only">{t.open}</span>
        </a>
      ) : (
        <Link href={inboxHref} className="absolute inset-0 z-10">
          <span className="sr-only">{t.seeAll}</span>
        </Link>
      )}
    </article>
  );
}
