// 화면 표시용 breadcrumb (BreadcrumbList JSON-LD 와 항목 동일). 마지막 항목은 링크 없이 현재 위치.
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { localePath } from '@/lib/seo';
import type { Locale } from '@123band/shared';

export function Breadcrumbs({
  locale,
  items,
}: {
  locale: Locale;
  items: { name: string; path: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="container-band pt-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-grey-500">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.path} className="flex items-center gap-1">
              {last ? (
                <span aria-current="page" className="max-w-[16rem] truncate font-medium text-grey-700">
                  {it.name}
                </span>
              ) : (
                <>
                  <Link href={localePath(locale, it.path)} className="hover:text-black hover:underline">
                    {it.name}
                  </Link>
                  <ChevronRight size={12} className="text-grey-300" aria-hidden />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
