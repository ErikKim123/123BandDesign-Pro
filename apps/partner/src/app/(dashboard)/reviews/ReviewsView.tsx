// 고객 후기 목록 뷰 (오거나이저). 서버에서 주입된 본인 상품 후기를 별점과 함께 표시.
'use client';
import { Star } from 'lucide-react';
import type { I18n } from '@123band/shared';
import { useT } from '@/i18n/useT';
import { useI18nText } from '@/lib/i18n/locale-context';
import type { PartnerReview } from '@/lib/queries/partner-reviews';

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          className={i <= n ? 'fill-amber-400 text-amber-400' : 'fill-none text-grey-300'}
        />
      ))}
    </span>
  );
}

export function ReviewsView({ reviews }: { reviews: PartnerReview[] }) {
  const t = useT();
  const r = t.reviews;
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, x) => s + x.rating, 0) / count : 0;

  const i18nText = useI18nText();
  const productName = (rv: PartnerReview) =>
    (rv.products?.name_i18n ? i18nText(rv.products.name_i18n as I18n) : '') || '—';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-grey-900">{r.title}</h1>
        <p className="mt-1 text-sm text-grey-500">{r.subtitle}</p>
      </div>

      {count > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-grey-200 p-3 text-sm">
          <Stars n={Math.round(avg)} />
          <span className="font-semibold text-grey-900">{avg.toFixed(1)}</span>
          <span className="text-grey-400">· {r.count(count)}</span>
        </div>
      )}

      {count === 0 ? (
        <p className="py-16 text-center text-grey-400">{r.empty}</p>
      ) : (
        <ul className="divide-y divide-grey-100 overflow-hidden rounded-lg border border-grey-200">
          {reviews.map((rv) => (
            <li key={rv.id} className="p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Stars n={rv.rating} />
                  <span className="text-sm font-medium text-grey-800">{rv.author_name || '—'}</span>
                </div>
                <span className="text-xs text-grey-400">{rv.created_at.slice(0, 10)}</span>
              </div>
              <p className="text-xs text-grey-500">{productName(rv)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-grey-700">
                {rv.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
