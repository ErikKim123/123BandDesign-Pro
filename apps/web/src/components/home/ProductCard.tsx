// Design Ref: Wolf Design System / components/data (Card·PassCard) — 상품 카드 (이미지 placeholder + 명/가/배지)
import Link from 'next/link';
import Image from 'next/image';
import { Package } from 'lucide-react';
import {
  baseCurrency,
  pickI18n,
  formatPrice,
  discountPercent,
  productPath,
  type Locale,
} from '@123band/shared';
import { currencyForLocale, intlLocale } from '@/lib/locale';
import type { HomeProduct } from '@/lib/queries/home';
import type { Dictionary } from '@/i18n/dictionaries';
import { storageImageProps } from '@/lib/image';

export function ProductCard({
  product,
  locale,
  dict,
}: {
  product: HomeProduct;
  locale: Locale;
  dict: Dictionary;
}) {
  const name = pickI18n(product.name_i18n, locale);
  const intl = intlLocale(locale);
  // 표시 통화: 결제 통화 가격이 있으면 그대로, 없으면 행사 국가 통화 → 상세와 같은 기준(환산가 노출 방지).
  const currency = baseCurrency(
    product.passes?.length ? product.passes.map((p) => p.prices) : [product.prices],
    currencyForLocale(locale),
    product.country,
  );
  // 티켓 상품에 판매 패스(Full/Party 등)가 여럿이면 패스명+가격을 함께 표기.
  // 패스가 없거나(실물/구독) 하나면 대표가 단일 표기.
  const passes = (product.passes ?? []).filter((p) => formatPrice(p.prices, currency, intl));
  const price = formatPrice(product.prices, currency, intl);
  const badge = product.is_partner_product ? dict.product.partner : dict.product.official;

  return (
    <Link href={productPath(locale, product)} className="product-card">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-grey-100">
        {product.image_url ? (
          <Image
            {...storageImageProps(product.image_url, 640)}
            alt={name || ''}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        ) : (
          <Package size={40} className="text-grey-300" aria-hidden />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="label-caps text-grey-400">{badge}</span>
        <p className="line-clamp-2 text-sm font-medium text-black">{name || '—'}</p>
        {/* 가격은 상품명 바로 아래(윗정렬) — 카드 높이가 달라도 아래로 밀지 않는다.
            바닥 정렬이면 패스가 1~2개인 카드에서 제목과 가격이 멀어져 한 덩어리로 안 읽힌다. */}
        {passes.length >= 2 ? (
          <ul className="space-y-0.5 pt-1">
            {passes.map((p, i) => {
              const passName = pickI18n(p.name, locale);
              const pct = discountPercent(p.prices, p.listPrices, currency);
              return (
                <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-grey-500">{passName || '—'}</span>
                  <span className="flex shrink-0 items-baseline gap-1">
                    {pct > 0 && (
                      <span className="text-[11px] font-bold text-primary">{pct}% OFF</span>
                    )}
                    <span className="font-display font-bold text-ink">
                      {formatPrice(p.prices, currency, intl)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          (() => {
            const solo = passes[0];
            const pct = solo ? discountPercent(solo.prices, solo.listPrices, currency) : 0;
            const soloPrice = (solo && formatPrice(solo.prices, currency, intl)) || price;
            return (
              <p className="flex items-baseline gap-2 pt-1">
                {pct > 0 && <span className="text-xs font-bold text-primary">{pct}% OFF</span>}
                <span className="font-display text-lg font-bold text-ink">{soloPrice || '—'}</span>
              </p>
            );
          })()
        )}
      </div>
    </Link>
  );
}
