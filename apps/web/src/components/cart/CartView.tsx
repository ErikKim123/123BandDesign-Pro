// Design Ref: §5 Phase 4 — 장바구니 화면 (수량 조절·삭제·합계·체크아웃)
'use client';
import Link from 'next/link';
import { Minus, Plus, Trash2, Package } from 'lucide-react';
import {
  baseCurrency,
  pickI18n,
  pickPrice,
  formatPrice,
  DISPLAY_CURRENCIES,
  type Currency,
  type Locale,
  type Prices,
} from '@123band/shared';
import { intlLocale } from '@/lib/locale';
import { useCart, lineKey, type CartItem } from '@/lib/cart/CartContext';
import { useDisplayCurrency } from '@/lib/currency/CurrencyContext';
import { CurrencyToggle } from '@/components/cart/CurrencyToggle';
import type { Dictionary } from '@/i18n/dictionaries';
import { storageThumb } from '@/lib/image';

export function CartView({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { items, setQty, remove } = useCart();
  // 표시 통화(상세에서 고른 값이 이어짐). 결제는 payCurrency(USD/KRW)로 진행 — 표기만 서브통화.
  const { chosenCurrency, payCurrency } = useDisplayCurrency();
  const intl = intlLocale(locale);

  const fmt = (minor: number, cur: Currency) => formatPrice({ [cur]: minor } as Prices, cur, intl);

  // 기준 통화 — 결제 통화가 모든 항목에 입력돼 있으면 그대로, 아니면 값이 있는 통화(바트만 넣은 티켓 → ฿).
  // 상세에서 ฿ 로 본 가격이 장바구니에서 US$ 환산으로 바뀌지 않게 한다.
  const baseCur = baseCurrency(items.map((i) => i.prices), payCurrency);
  // 토글 노출 — 기준 통화 + '모든 항목'에 실제 값이 입력된 통화만(부분 입력·환산 제외).
  // 결제 통화라도 값이 없으면 넣지 않는다 — 눌러도 가격이 안 바뀌는 죽은 버튼 방지.
  const availableCurrencies = DISPLAY_CURRENCIES.filter(
    (c) => c === baseCur || (items.length > 0 && items.every((i) => i.prices[c] != null)),
  );
  // 실효 표시 통화 — 직접 고른 값이 여기서 못 쓰이면(또는 안 골랐으면) 기준 통화로 폴백.
  const displayCur =
    chosenCurrency && availableCurrencies.includes(chosenCurrency) ? chosenCurrency : baseCur;

  const unitMinor = (i: CartItem) => pickPrice(i.prices, displayCur) ?? 0;
  const totalMinor = items.reduce((s, i) => s + unitMinor(i) * i.qty, 0);
  // 실제 결제(payCurrency) 기준 합계 — 안내 문구 "실제 결제 …" 용.
  const payTotalMinor = items.reduce((s, i) => s + (pickPrice(i.prices, payCurrency) ?? 0) * i.qty, 0);

  const productTypes = dict.product.types as Record<string, string>;
  const typeLabel = (t: string) => productTypes[t] ?? '';

  if (items.length === 0) {
    return (
      <div className="container-band py-20 text-center">
        <p className="text-grey-500">{dict.cart.empty}</p>
        <Link href={`/${locale}`} className="btn btn-secondary btn-sm mt-4">
          {dict.cart.continue}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-band max-w-3xl py-8">
      <h1 className="section-title mb-6">{dict.cart.title}</h1>

      {/* 통화 토글 — 상세와 동일. 서브통화로 보면 결제 통화 안내가 붙는다(결제는 결제 통화). */}
      <CurrencyToggle
        available={availableCurrencies}
        base={baseCur}
        locale={locale}
        className="mb-4"
      />

      <ul className="divide-y divide-grey-100 border-y border-grey-100">
        {items.map((i) => (
          <li key={lineKey(i.id, i.ticketKey)} className="flex flex-wrap items-center gap-4 py-4">
            {/* 썸네일 — 클릭 시 상세 페이지로 이동 */}
            <Link
              href={`/${locale}/products/${i.id}`}
              className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-grey-100 transition hover:opacity-80 sm:h-28 sm:w-28"
              aria-label={pickI18n(i.name_i18n, locale)}
            >
              {i.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={storageThumb(i.image_url, 256)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package size={32} className="text-grey-300" aria-hidden />
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="label-caps text-grey-400">
                  {i.is_partner_product ? dict.product.partner : dict.product.official}
                </span>
                {typeLabel(i.product_type) && (
                  <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-[11px] font-medium text-grey-600">
                    {typeLabel(i.product_type)}
                  </span>
                )}
              </div>
              <p className="truncate font-medium">{pickI18n(i.name_i18n, locale)}</p>
              {i.ticketName && pickI18n(i.ticketName, locale) && (
                <p className="truncate text-sm font-medium text-primary">{pickI18n(i.ticketName, locale)}</p>
              )}
              {i.meta_i18n && pickI18n(i.meta_i18n, locale) && (
                <p className="truncate text-sm text-grey-500">{pickI18n(i.meta_i18n, locale)}</p>
              )}
              <p className="text-sm text-grey-500">{fmt(unitMinor(i), displayCur)}</p>
            </div>

            {/* 모바일: 수량·가격·삭제를 한 줄 아래로 내려 상품명 폭 확보 / sm+: 기존처럼 인라인 */}
            <div className="flex w-full items-center gap-4 sm:w-auto">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQty(lineKey(i.id, i.ticketKey), i.qty - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-pill border border-grey-300 hover:bg-grey-100"
                  aria-label="-"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm">{i.qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(lineKey(i.id, i.ticketKey), i.qty + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-pill border border-grey-300 hover:bg-grey-100"
                  aria-label="+"
                >
                  <Plus size={14} />
                </button>
              </div>

              <p className="ml-auto w-24 text-right font-medium sm:ml-0">{fmt(unitMinor(i) * i.qty, displayCur)}</p>
              <button
                type="button"
                onClick={() => remove(lineKey(i.id, i.ticketKey))}
                className="text-grey-400 hover:text-danger"
                aria-label={dict.cart.remove}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between">
        <span className="label-caps">{dict.cart.total}</span>
        <span className="font-display text-2xl">{fmt(totalMinor, displayCur)}</span>
      </div>
      {displayCur !== payCurrency && (
        <p className="mt-1 text-right text-xs text-grey-400">
          {locale === 'ko'
            ? `실제 결제 ${fmt(payTotalMinor, payCurrency)}`
            : `Charged as ${fmt(payTotalMinor, payCurrency)}`}
        </p>
      )}

      <Link href={`/${locale}/checkout`} className="btn btn-primary mt-6 w-full">
        {dict.cart.proceedToCheckout}
      </Link>
    </div>
  );
}
