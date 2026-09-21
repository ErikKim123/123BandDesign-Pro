// 마이페이지 탭 "확인함" 기록 — 배지가 떠 있는 탭에 들어가면 그 시각을 남기고 배지를 지운다.
//
// 서버 컴포넌트(layout)는 읽기만 하므로 기록은 여기서 한다.
// 소셜 탭은 NotifySettings 가 mark_hearts_read 로 같은 일을 하므로 여기서는 제외한다.
'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** 배지가 떠 있는 탭만 처리한다 — pendingTabs 는 서버가 계산해 내려준다. */
export function AccountTabSeen({ locale, pendingTabs }: { locale: string; pendingTabs: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  // 한 번 기록한 탭은 다시 건드리지 않는다. router.refresh() → 재렌더 → 재호출 루프를 막는다.
  const markedRef = useRef<Set<string>>(new Set());
  // 배열은 렌더마다 새 참조라 의존성으로 쓰면 매번 effect 가 돈다 — 값으로 비교되게 문자열로.
  const pending = pendingTabs.join(',');

  useEffect(() => {
    const prefix = `/${locale}/account/`;
    if (!pathname.startsWith(prefix)) return;
    const tab = pathname.slice(prefix.length).split('/')[0];
    if (!tab || tab === 'social') return;
    if (!pending.split(',').includes(tab) || markedRef.current.has(tab)) return;

    markedRef.current.add(tab);
    void (async () => {
      const { error } = await createClient().rpc('mark_tab_seen', { p_tab: tab });
      // 실패하면 다음 진입에서 다시 시도할 수 있게 표시를 되돌린다.
      if (error) markedRef.current.delete(tab);
      else router.refresh();
    })();
  }, [pathname, locale, pending, router]);

  return null;
}
