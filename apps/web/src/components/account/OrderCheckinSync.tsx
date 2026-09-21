// 오거나이저가 입장 QR 을 스캔하면 order_items.checked_in_count 가 +1 된다(=남은 입장 -1).
// 이 헤드리스 컴포넌트가 그 증가를 감지해 주문내역 페이지를 자동 새로고침 → 남은 입장 수가 즉시 반영된다.
// 실시간(Supabase Realtime) 우선, 미설정 환경 대비 폴링 + 탭 복귀 시 즉시 반영 폴백까지 둔다.
'use client';
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function OrderCheckinSync({
  pendingItems,
}: {
  /** 아직 소진되지 않은 티켓 항목 + 현재 입장 카운트(baseline) */
  pendingItems: { id: string; count: number }[];
}) {
  const router = useRouter();
  // 안정적인 키로 의존성 고정 — 카운트가 오르면(스캔) 서버 렌더가 갱신되어 목록/기준이 바뀐다.
  const key = pendingItems.map((p) => `${p.id}:${p.count}`).join(',');

  useEffect(() => {
    // 키에서 baseline 재구성 (stale closure/의존성 경고 회피)
    const base = new Map(
      key
        ? key.split(',').map((s) => {
            const [id, c] = s.split(':');
            return [id, Number(c)] as const;
          })
        : [],
    );
    if (base.size === 0) return; // 감시할 미소진 티켓 없음
    const ids = [...base.keys()];
    const supabase = createClient();

    // 중복 새로고침 억제 (다음 서버 렌더가 반영될 때까지 짧게)
    let refreshing = false;
    const refresh = () => {
      if (refreshing) return;
      refreshing = true;
      router.refresh();
      setTimeout(() => {
        refreshing = false;
      }, 1500);
    };

    // 1) 실시간 — 감시 대상 항목의 checked_in_count 가 기준보다 커지면(=스캔됨) 반영.
    const channel = supabase
      .channel('order-checkin-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: DB_SCHEMA, table: 'order_items' },
        (payload) => {
          const row = payload.new as { id?: string; checked_in_count?: number | null };
          const b = row?.id ? base.get(row.id) : undefined;
          if (b !== undefined && typeof row?.checked_in_count === 'number' && row.checked_in_count > b) {
            refresh();
          }
        },
      )
      .subscribe((status) => {
        // realtime 미설정(publication 미포함) 환경이면 CHANNEL_ERROR/TIMED_OUT.
        // 폴백(폴링 + 탭 복귀)이 이어받으므로 동작엔 지장 없고, 관측을 위해 로깅만 남긴다.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[checkin-sync] realtime unavailable, using poll fallback:', status);
        }
      });

    // 2) 폴백 폴링 — realtime 미설정 대비. 화면이 보이는 동안만 카운트 증가를 확인.
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      supabase
        .from('order_items')
        .select('id, checked_in_count')
        .in('id', ids)
        .then(({ data }) => {
          if (
            data?.some(
              (d) =>
                typeof d.checked_in_count === 'number' &&
                d.checked_in_count > (base.get(d.id as string) ?? 0),
            )
          ) {
            refresh();
          }
        });
    }, 7000);

    // 3) 탭으로 돌아오면 즉시 반영 — QR 을 오거나이저에게 보여준 뒤 화면으로 복귀하는 흐름
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, router]);

  return null;
}
