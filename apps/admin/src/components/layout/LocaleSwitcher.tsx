// Design Ref: 어드민 EN/KO 전환 토글 — 사이드바 헤더에 배치.
'use client';
import { useRouter } from 'next/navigation';
import type { AdminLocale } from '@/i18n/dict';
import { useLocale } from '@/lib/locale/LocaleContext';
import { cn } from '@/lib/utils';

// 표시 순서: EN / KO (상수 ADMIN_LOCALES 은 기본값/타입용이라 그대로 두고 노출 순서만 고정)
const TOGGLE_ORDER: AdminLocale[] = ['en', 'ko'];

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const router = useRouter();

  return (
    <div className="inline-flex rounded-pill border border-grey-200 p-0.5">
      {TOGGLE_ORDER.map((l) => (
        <button
          key={l}
          onClick={() => {
            if (l === locale) return;
            setLocale(l);
            router.refresh(); // 서버 컴포넌트(레이아웃/페이지) 재렌더로 쿠키 반영
          }}
          className={cn(
            'rounded-pill px-2.5 py-1 text-xs font-medium uppercase transition-colors',
            l === locale ? 'bg-black text-white' : 'text-grey-500 hover:text-black',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
