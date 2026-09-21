// 스위처 콘솔이 쓰는 훅 모음 — 단축키 / 화면 꺼짐 방지 / 실시간 동기화 / 동시 접속 감지 / 1초 타이머.
'use client';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { LIVE_QKEY, type LiveBroadcastRow } from '@/lib/queries/live';

/**
 * 단축키 — 1~4 전환, Space 직전 앵글, ? 도움말.
 * 입력칸(공지·진행 순서)에 포커스가 있으면 절대 발동하지 않는다. 방송 중에 공지를 치다가
 * 숫자를 눌렀는데 앵글이 바뀌는 사고가 제일 위험하다.
 */
export function useSwitcherHotkeys(handlers: {
  onSlot: (slot: number) => void;
  onToggle: () => void;
  onHelp: () => void;
  enabled: boolean;
}) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    function isTyping(el: EventTarget | null): boolean {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        node.isContentEditable === true
      );
    }
    function onKey(e: KeyboardEvent) {
      const h = ref.current;
      if (!h.enabled) return;
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        h.onSlot(Number(e.key));
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault(); // 스페이스로 페이지가 스크롤되지 않게
        h.onToggle();
        return;
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        h.onHelp();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** 화면 꺼짐 방지 — 미지원 브라우저에서는 조용히 넘어간다(기능을 막지 않는다). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    type WakeLockSentinelLike = { release: () => Promise<void> };
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    const acquire = () => {
      nav.wakeLock
        ?.request('screen')
        .then((s) => {
          if (cancelled) void s.release();
          else sentinel = s;
        })
        .catch(() => {
          // 탭이 백그라운드면 거부된다 — 복귀 시 visibilitychange 로 다시 시도한다.
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}

/**
 * 방송 행 실시간 동기화 — 다른 관리자의 전환, 브리지의 상태 보고가 이 화면에 바로 들어온다.
 * Realtime 이 안 되는 환경을 위해 폴링(5초)을 함께 돌린다. 라이브 중에 끊긴 채 방치되면 안 된다.
 */
export function useBroadcastSync(id: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    const apply = (row: LiveBroadcastRow) =>
      qc.setQueryData([LIVE_QKEY, 'detail', id], (prev: LiveBroadcastRow | undefined) =>
        prev ? { ...prev, ...row } : row,
      );

    const channel = supabase
      .channel(`live-broadcast-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: DB_SCHEMA, table: 'live_broadcasts', filter: `id=eq.${id}` },
        (payload) => apply(payload.new as LiveBroadcastRow),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[switcher] realtime unavailable, using poll fallback:', status);
        }
      });

    const poll = setInterval(() => {
      qc.invalidateQueries({ queryKey: [LIVE_QKEY, 'detail', id] });
      qc.invalidateQueries({ queryKey: [LIVE_QKEY, 'switch-log', id] });
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [id, qc]);
}

/**
 * 같은 스위처를 누가 또 열었는지 — Realtime Presence 로 센다.
 * 하드 잠금은 걸지 않는다. 현장에서 잠금이 안 풀리면 그게 더 큰 사고다.
 */
export function useSwitcherPresence(id: string | null, me: string) {
  const [others, setOthers] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    const channel = supabase.channel(`switcher-presence-${id}`, {
      config: { presence: { key: me || 'unknown' } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setOthers(Object.keys(state).filter((k) => k !== me));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ at: Date.now() });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, me]);

  return others;
}

/** 1초마다 리렌더 — 경과 시간·앵글 유지 시간 표시용. */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** 라이브 중 이탈 경고 — 실수로 탭을 닫는 것을 막는다. */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}
