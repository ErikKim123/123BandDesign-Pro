// 소셜 알림 — 인앱(안읽음 배지·실시간 갱신) + 웹푸시 + 이메일 요약 설정.
//
// 마이페이지 레이아웃에서 항상 마운트되지만 설정 UI 를 그리는 건 소셜 탭에서만이다.
// 반면 수신 감지(Realtime + 폴백 폴링)는 마이페이지 어느 탭에서든 돈다 —
// 안읽음 배지가 레이아웃(모든 탭)에 있어서, 주문내역을 보고 있어도 배지가 올라와야 한다.
//
// 즉시 반영 경로가 두 겹인 이유:
//   1) Realtime — 정상 경로. INSERT 를 받으면 곧바로 refresh.
//   2) 폴링(20초) — RLS 가 걸린 테이블의 postgres_changes 는 realtime 이 JWT 를 못 받으면
//      조용히 아무것도 안 온다. 그 경우 새로고침 전까지 영영 안 보이므로 안전망을 둔다.
//      탭이 백그라운드면 폴링을 멈춘다(보이지도 않는 화면을 위해 요청할 이유가 없다).
'use client';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, BellOff, ChevronRight, Mail, Share, Smartphone, SquarePlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  currentSubscription,
  pushSupport,
  subscribePush,
  unsubscribePush,
  type PushSupport,
} from '@/lib/push/subscribe';

export interface NotifyStrings {
  title: string;
  pushLabel: string;
  pushHint: string;
  pushOn: string;
  pushOff: string;
  pushDenied: string;
  pushUnsupported: string;
  pushIosHint: string;
  iosStepShare: string;
  iosStepAdd: string;
  iosStepOpen: string;
  emailLabel: string;
  emailHint: string;
  on: string;
  off: string;
}

export function NotifySettings({
  locale,
  userId,
  emailDigest,
  t,
}: {
  locale: string;
  userId: string;
  emailDigest: boolean;
  t: NotifyStrings;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onSocialTab = pathname === `/${locale}/account/social`;

  const [support, setSupport] = useState<PushSupport | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState(emailDigest);
  const markedRef = useRef(false);
  // 콜백(Realtime·폴링) 안에서 "지금 소셜 탭인가"를 봐야 하는데, 이걸 effect 의존성에 넣으면
  // 탭을 옮길 때마다 채널을 끊었다 다시 붙인다. 값만 최신으로 들고 있으면 충분하다.
  const onSocialTabRef = useRef(onSocialTab);
  onSocialTabRef.current = onSocialTab;

  // 받은 반응을 읽음 처리 → 배지 제거. 소셜 탭을 보고 있을 때만 의미가 있다.
  const markRead = useCallback(async () => {
    const { data } = await createClient().rpc('mark_hearts_read');
    if (typeof data === 'number' && data > 0) router.refresh();
  }, [router]);

  // 새 반응이 도착했을 때 화면을 맞춘다. 목록·카운트를 다시 그리고,
  // 소셜 탭을 보고 있었다면 방금 온 것까지 읽음 처리한다.
  const onIncoming = useCallback(() => {
    router.refresh();
    if (onSocialTabRef.current) void markRead();
  }, [router, markRead]);

  // 현재 기기의 구독 상태 파악 — 기기마다 다르므로 서버 값이 아니라 브라우저에 물어본다.
  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s !== 'ok') return;
    setDenied(Notification.permission === 'denied');
    currentSubscription().then((sub) => setPushOn(Boolean(sub)));
  }, []);

  // 소셜 탭 진입 시 1회 읽음 처리.
  // markedRef 로 막지 않으면 refresh() → 재렌더 → 다시 호출로 루프가 된다.
  useEffect(() => {
    if (!onSocialTab || markedRef.current) return;
    markedRef.current = true;
    void markRead();
  }, [onSocialTab, markRead]);

  // 앱을 열어둔 채 반응을 받는 경우 — Realtime 으로 즉시 반영(푸시 권한이 없어도 동작).
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      // RLS 테이블의 postgres_changes 는 realtime 소켓이 사용자 JWT 를 알아야 행을 흘려보낸다.
      // 세션 토큰을 명시적으로 넘겨 둔다(클라이언트가 자동으로 넣어 주는 타이밍에 의존하지 않게).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel('social-hearts-me')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: DB_SCHEMA,
            table: 'social_hearts',
            filter: `to_user_id=eq.${userId}`,
          },
          onIncoming,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, onIncoming]);

  // 폴백 — Realtime 이 막혀도 최대 20초 안에는 반영된다. 탭이 보일 때만 돈다.
  useEffect(() => {
    const supabase = createClient();
    let lastSeen: number | null = null;

    async function poll() {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase.rpc('my_unread_hearts');
      const n = typeof data === 'number' ? data : 0;
      // 첫 호출은 기준값만 잡고 넘어간다(마운트 직후 불필요한 refresh 방지).
      if (lastSeen !== null && n > lastSeen) onIncoming();
      lastSeen = n;
    }

    const timer = setInterval(poll, 20_000);
    // 다른 탭/앱에 갔다 돌아온 순간은 가장 밀렸을 때다 — 즉시 한 번 확인한다.
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [onIncoming]);

  const togglePush = useCallback(async () => {
    setBusy(true);
    try {
      if (pushOn) {
        await unsubscribePush();
        setPushOn(false);
      } else {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
        const result = await subscribePush(key);
        if (result === 'ok') setPushOn(true);
        if (result === 'denied') setDenied(true);
      }
    } finally {
      setBusy(false);
    }
  }, [pushOn]);

  const toggleDigest = useCallback(async () => {
    const next = !digest;
    setDigest(next);
    await createClient().rpc('set_notify_prefs', { p_email_digest: next });
  }, [digest]);

  if (!onSocialTab) return null;

  return (
    <section className="mt-8 rounded-lg border border-grey-200 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Bell size={16} className="text-primary" aria-hidden />
        {t.title}
      </h2>

      {/* 웹푸시 */}
      <div className="mt-4 flex items-start gap-3">
        <Smartphone size={18} className="mt-0.5 shrink-0 text-grey-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t.pushLabel}</p>
          <p className="mt-0.5 text-xs text-grey-500">
            {support === 'ios-needs-install'
              ? t.pushIosHint
              : support === 'unsupported'
                ? t.pushUnsupported
                : denied
                  ? t.pushDenied
                  : t.pushHint}
          </p>
        </div>
        <button
          type="button"
          onClick={togglePush}
          disabled={busy || support !== 'ok' || denied}
          aria-pressed={pushOn}
          className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            pushOn ? 'bg-primary text-white' : 'bg-grey-100 text-grey-700'
          }`}
        >
          {pushOn ? (
            <span className="inline-flex items-center gap-1">
              <Bell size={12} aria-hidden />
              {t.pushOn}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <BellOff size={12} aria-hidden />
              {t.pushOff}
            </span>
          )}
        </button>
      </div>

      {/* iOS 설치 안내 — 홈 화면에 추가하기 전에는 푸시를 켤 수 없어서, 눌러야 할
          아이콘을 그대로 보여준다. iOS 에는 '홈 화면에 추가'를 코드로 띄우는 API 가
          없다(안드로이드의 beforeinstallprompt 같은 게 없다). 그래서 실행 버튼이 아니라
          아이콘 안내다. 브라우저는 가리지 않는다 — 사파리·크롬 어느 쪽이든 같다. */}
      {support === 'ios-needs-install' && (
        <ol className="mt-3 flex items-center gap-1 rounded-lg bg-cream-light px-2 py-2.5">
          {[
            { icon: <Share size={18} aria-hidden />, label: t.iosStepShare },
            { icon: <SquarePlus size={18} aria-hidden />, label: t.iosStepAdd },
            {
              icon: (
                // 홈 화면에 생기는 실제 아이콘을 그대로 보여준다
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/icon-192.png" alt="" className="h-[18px] w-[18px] rounded-[4px]" />
              ),
              label: t.iosStepOpen,
            },
          ].map((step, i) => (
            <li key={step.label} className="flex min-w-0 flex-1 items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="shrink-0 text-grey-300" aria-hidden />}
              <span className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-primary shadow-sm">
                  {step.icon}
                </span>
                <span className="text-[11px] leading-tight text-grey-600">{step.label}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* 이메일 요약 */}
      <div className="mt-4 flex items-start gap-3 border-t border-grey-100 pt-4">
        <Mail size={18} className="mt-0.5 shrink-0 text-grey-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t.emailLabel}</p>
          <p className="mt-0.5 text-xs text-grey-500">{t.emailHint}</p>
        </div>
        <button
          type="button"
          onClick={toggleDigest}
          aria-pressed={digest}
          className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors ${
            digest ? 'bg-primary text-white' : 'bg-grey-100 text-grey-700'
          }`}
        >
          {digest ? t.on : t.off}
        </button>
      </div>
    </section>
  );
}
