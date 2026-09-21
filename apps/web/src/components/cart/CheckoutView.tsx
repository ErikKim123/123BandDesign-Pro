// Design Ref: §5 Phase 4 — 체크아웃 (서버 결제 시작 → PayVerse 통합결제창).
// 주문 생성·금액계산·쿠폰차감·서명(sign)은 전부 서버(/api/payments/checkout)가 수행.
// 여기선 장바구니→결제 트리거 + SDK 호출만 담당한다.
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import {
  CalendarDays,
  MapPin,
  User,
  Package,
  Tag,
  X,
  Minus,
  Plus,
  ExternalLink,
  Trash2,
  Landmark,
  Copy,
  Check,
} from 'lucide-react';
import {
  baseCurrency,
  pickI18n,
  pickPrice,
  formatPrice,
  DISPLAY_CURRENCIES,
  formatEventAddress,
  type Currency,
  type EventContent,
  type Locale,
  type Prices,
} from '@123band/shared';
import { currencyForLocale, intlLocale } from '@/lib/locale';
import { useCart, lineKey } from '@/lib/cart/CartContext';
import { useDisplayCurrency } from '@/lib/currency/CurrencyContext';
import { CurrencyToggle } from '@/components/cart/CurrencyToggle';
import { WeChatPayBlock, WeChatPayBadge, HAS_WECHAT_QR } from '@/components/cart/WeChatPayBlock';
import { KRW_BANK, KAKAOPAY_URL, FX_BANK } from '@/lib/payments/transfer-info';
import { createClient } from '@/lib/supabase/client';
import { validateCoupon, listMyCoupons, type MyCoupon } from '@/lib/coupon';
import { loadPayverseSdk, type PayverseResult } from '@/lib/payments/payverse-sdk';
import { CARD_PAYMENTS_ENABLED } from '@/lib/payments/methods';
import type { Dictionary } from '@/i18n/dictionaries';
import { storageThumb } from '@/lib/image';

// 송금 계좌·링크 상수는 재결제(주문내역)와 공용 — lib/payments/transfer-info 에서 단일 관리.

export function CheckoutView({
  locale,
  dict,
  userId,
  paymentEnabled,
  wiseUrl = '',
}: {
  locale: Locale;
  dict: Dictionary;
  userId: string;
  paymentEnabled: boolean;
  // Wise 송금 링크(어드민 설정). 빈 문자열이면 Wise 옵션을 숨긴다. QR/버튼 모두 이 URL 로 연결.
  wiseUrl?: string;
}) {
  // userId 는 서버 가드용으로 받지만 결제 본인확인은 서버가 세션으로 재확인한다.
  void userId;
  const { items, purge, setQty, remove } = useCart();
  // currency = 실제 결제 통화(USD/KRW). 쿠폰·결제금액·송금액은 전부 이 통화 기준(서버도 동일).
  const currency = currencyForLocale(locale) as Currency;
  // 화면 표기 통화(상세에서 고른 값이 이어짐). 오거나이저가 입력한 값만 쓰고 지어내지 않는다.
  const { chosenCurrency } = useDisplayCurrency();
  // 기준 통화 — 결제 통화가 모든 항목에 입력돼 있으면 그대로, 아니면 값이 있는 통화(바트만 넣은 티켓 → ฿).
  const baseCur = baseCurrency(items.map((i) => i.prices), currency);
  // 토글 노출 — 기준 통화 + '모든 항목'에 실제 값이 입력된 통화만. 결제 통화라도 값이 없으면 넣지 않는다
  // (눌러도 가격이 안 바뀌는 죽은 버튼 방지). 실효 표시 통화(displayCur)는 폴백 포함.
  const availableCurrencies = DISPLAY_CURRENCIES.filter(
    (c) => c === baseCur || (items.length > 0 && items.every((i) => i.prices[c] != null)),
  );
  const displayCur =
    chosenCurrency && availableCurrencies.includes(chosenCurrency) ? chosenCurrency : baseCur;
  const isSubDisplay = displayCur !== currency;
  const search = useSearchParams();
  const [placing, setPlacing] = useState(false);
  // 계좌이체 모달 노출 여부 — 버튼을 누르면 앞으로 떠서 계좌정보(KO) 또는 Wise QR/링크(EN)를 보여준다.
  const [transferOpen, setTransferOpen] = useState(false);
  // 복사 피드백 — 어떤 값(계좌/카카오페이)을 복사했는지 키로 구분
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // 송금 완료 알림 상태 — 고객이 "송금했어요"를 누르면 운영자에게 메일 발송
  const [notifyState, setNotifyState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // 결제수단(카드/간편결제) 선택은 PayVerse 통합결제창이 담당한다 → 여기선 고르지 않는다.
  const [error, setError] = useState<string | null>(
    search.get('canceled') ? dict.cart.canceled : null,
  );

  const intl = intlLocale(locale);
  // payFmt: 실제 결제 통화로 포맷(결제·송금액). dispFmt: 실효 표기 통화로 포맷(라인·소계·합계 표시).
  const payFmt = (minor: number) => formatPrice({ [currency]: minor } as Prices, currency, intl);
  const dispFmt = (minor: number) => formatPrice({ [displayCur]: minor } as Prices, displayCur, intl);

  // 결제 통화(payment) 기준 합계 — 쿠폰/결제/무료판정의 기준.
  const totalMinor = items.reduce((s, i) => s + (pickPrice(i.prices, currency) ?? 0) * i.qty, 0);
  // 표기 통화(displayCur) 기준 소계 — displayCur 는 모든 항목에 입력된 통화이거나 결제 통화 → 환산 없음.
  const subtotalDisp = items.reduce((s, i) => s + (pickPrice(i.prices, displayCur) ?? 0) * i.qty, 0);

  // 상품 유형 배지 라벨 (Ticket/Product/Subscription)
  const productTypes = dict.product.types as Record<string, string>;
  const typeLabel = (t: string) => productTypes[t] ?? '';

  // 패스 상세(일시·장소·주최자)는 장바구니에 저장돼 있지 않으므로, 상품 id 로 event_content 를 조회해 보강한다.
  // (장바구니 이미지 백필과 동일하게 공개읽기 products 테이블 조회)
  const [details, setDetails] = useState<Record<string, EventContent | null>>({});
  const idKey = items.map((i) => i.id).join(',');
  useEffect(() => {
    const ids = idKey ? idKey.split(',') : [];
    if (ids.length === 0) {
      setDetails({});
      return;
    }
    let active = true;
    createClient()
      .from('products')
      // event_content 전체(sections HTML 등 수십KB)를 받지 않도록 카드에 쓰는 JSON 하위 경로만 선택
      .select(
        'id, banner:event_content->banner, startAt:event_content->>startAt, endAt:event_content->>endAt, location:event_content->location, address:event_content->address, organizer:event_content->organizer',
      )
      .in('id', ids)
      .then(({ data, error }) => {
        if (error) {
          // 베스트에포트 보강 — 실패해도 이름/가격은 표시되지만, 조용히 사라지지 않도록 로깅
          console.error('[checkout] 패스 상세 조회 실패', error);
          return;
        }
        if (!active || !data) return;
        const map: Record<string, EventContent | null> = {};
        for (const d of data as Array<Record<string, unknown>>) {
          map[d.id as string] = {
            banner: (d.banner as EventContent['banner']) ?? undefined,
            startAt: (d.startAt as string | null) ?? undefined,
            endAt: (d.endAt as string | null) ?? undefined,
            location: (d.location as EventContent['location']) ?? undefined,
            address: (d.address as EventContent['address']) ?? undefined,
            organizer: (d.organizer as EventContent['organizer']) ?? undefined,
          };
        }
        setDetails(map);
      });
    return () => {
      active = false;
    };
  }, [idKey]);

  // 일시 텍스트 — EventDetail 과 동일하게 KST 고정·24시간제(서버/클라 일치)
  const fmtEventDate = (ev: EventContent): string => {
    if (!ev.startAt) return '';
    const f = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(/[+Z]/.test(iso) ? iso : `${iso}+09:00`);
      if (Number.isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat(intl, {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul',
      }).format(d);
    };
    return `${f(ev.startAt)}${ev.endAt ? ` ~ ${f(ev.endAt)}` : ''}`;
  };

  const [couponCode, setCouponCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  // 할인코드 입력란은 기본 숨김 — "할인코드 입력" 버튼을 눌러야 노출
  const [showCoupon, setShowCoupon] = useState(false);
  // 내 쿠폰함(포인트 교환분) — 코드를 외우지 않고 눌러서 바로 적용한다. 패널을 열 때 1회 조회.
  const [myCoupons, setMyCoupons] = useState<MyCoupon[]>([]);
  useEffect(() => {
    if (!showCoupon || !userId || myCoupons.length > 0) return;
    void listMyCoupons().then(setMyCoupons).catch(() => setMyCoupons([]));
  }, [showCoupon, userId, myCoupons.length]);

  const discountMinor = applied?.discount ?? 0;
  const finalMinor = Math.max(0, totalMinor - discountMinor);
  // 표기 통화 환산 — 할인/최종액을 화면 통화로 근사 환산해 보여준다(계산·결제는 결제 통화 그대로).
  const discountDispMinor =
    discountMinor > 0 ? pickPrice({ [currency]: discountMinor } as Prices, displayCur) ?? 0 : 0;
  const finalDispMinor = Math.max(0, subtotalDisp - discountDispMinor);
  // 표시된 금액 기준 실효 할인율(%) — 쿠폰이 정률/정액이든 소계 대비 실제 할인 비율.
  const discountPct = totalMinor > 0 ? Math.round((discountMinor / totalMinor) * 100) : 0;
  // 무료(0원) 주문은 PG(PayVerse) 설정과 무관하게 진행 가능. 유료 주문만 결제 설정이 필요하다.
  const isFree = finalMinor <= 0;
  const canCheckout = paymentEnabled || isFree;

  // 계좌이체(대안 결제): KO=국내 우리은행 무통장입금, 그 외=Wise 송금 링크(어드민 설정).
  const useKrwBank = locale === 'ko';
  const showTransfer = !isFree && (useKrwBank || Boolean(wiseUrl));

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // 클립보드 접근 불가(구형 브라우저/비보안 컨텍스트) — 조용히 무시, 값은 화면에 그대로 보인다.
    }
  }

  // 고객이 송금을 마친 뒤 "알림 보내기" → 서버가 주문(입금확인 대기)을 생성하고 운영자에게 메일 발송.
  // 성공하면 장바구니를 비우고 내 주문내역(마이페이지)으로 이동한다. 입금 확인은 운영자가 수동.
  async function notifyTransfer() {
    setNotifyState('sending');
    try {
      const res = await fetch('/api/payments/transfer-notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          method: useKrwBank ? '계좌이체/카카오페이' : 'Wise',
          // 고객이 본 통화(서브통화면 바트 등)로 알림/기록 — 어드민 병기용. 서버가 결제 통화와 다를 때만 반영.
          amountText: dispFmt(finalDispMinor),
          displayCurrency: isSubDisplay ? displayCur : undefined,
          locale,
          couponCode: applied?.code ?? null,
          // 주문 생성용 카트 라인(서버가 금액 재계산) + 알림 메일 표시용 이름
          items: items.map((i) => ({
            id: i.id,
            qty: i.qty,
            ticketKey: i.ticketKey,
            name: pickI18n(i.name_i18n, locale),
          })),
        }),
      });
      if (!res.ok) throw new Error('notify failed');
      setNotifyState('sent');
      // 주문(입금 확인 대기)이 생성됐으니 장바구니를 비우고 내 주문내역으로 이동.
      // 하드 내비 직전에 purge → 처리된 항목이 남지 않는다.
      window.setTimeout(() => {
        purge();
        window.location.href = `/${locale}/account/orders`;
      }, 1600);
    } catch {
      setNotifyState('error');
    }
  }

  // 모달을 열 때 알림 상태를 초기화한다.
  function openTransfer() {
    setNotifyState('idle');
    setTransferOpen(true);
  }

  // code 를 넘기면 그 코드로(내 쿠폰함 클릭), 없으면 입력란 값으로 적용한다.
  async function applyCoupon(code?: string) {
    const target = code ?? couponCode;
    if (code) setCouponCode(code);
    setCouponMsg(null);
    const today = new Date().toISOString().slice(0, 10);
    const res = await validateCoupon(target, totalMinor, currency, today);
    if (res.ok) {
      setApplied({ code: res.coupon.code, discount: res.discount });
      setCouponMsg(dict.cart.couponApplied);
    } else {
      setApplied(null);
      setCouponMsg(res.reason === 'min' ? dict.cart.couponMin : dict.cart.couponInvalid);
    }
  }

  async function pay() {
    setError(null);
    setPlacing(true);
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, qty: i.qty, ticketKey: i.ticketKey })),
          couponCode: applied?.code ?? null,
          locale,
        }),
      });

      if (!res.ok) {
        setError(res.status === 503 ? dict.cart.payDisabled : dict.cart.payFailed);
        setPlacing(false);
        return;
      }
      const data = await res.json();

      // 0원주문 → 완료 페이지로 이동. 하드 내비게이션 전에 저장소까지 비워 처리된 항목이 남지 않게 한다.
      if (data.kind === 'free') {
        purge();
        window.location.href = data.redirectUrl;
        return;
      }

      // PayVerse → 통합결제창. 서명(sign)·가맹점정보는 서버가 만들어 내려준 값을 그대로 전달한다.
      if (data.kind === 'payverse') {
        const payVerse = await loadPayverseSdk(data.sdkUrl);
        // 모바일은 결제창이 페이지를 전환하고 returnUrl 로 복귀하므로 이 콜백에 도달하지 않는다.
        // 데스크톱(iframe)만 결과 객체를 돌려준다.
        payVerse.requestUI(data.params, (result: PayverseResult) => {
          void handlePayverseResult(data.orderId, data.orderNo, result);
        });
        return; // 결제창이 뜬 동안 버튼은 잠가 둔다(중복 요청 방지).
      }

      setError(dict.cart.payFailed);
      setPlacing(false);
    } catch {
      setError(dict.cart.payFailed);
      setPlacing(false);
    }
  }

  /** 데스크톱 결제창 콜백 → 서버 재검증(거래조회)으로 확정한 뒤 완료 페이지로 보낸다. */
  async function handlePayverseResult(orderId: string, orderNo: string, result: PayverseResult) {
    const status = result?.resultStatus;
    // 사용자가 창을 닫거나 승인 거절 — 장바구니는 그대로 두어 재시도할 수 있게 한다.
    if (status && status !== 'SUCCESS' && status !== 'PROCESSING' && status !== 'PENDING') {
      const msg = result?.resultMessage || dict.cart.payFailed;
      setError(msg);
      setPlacing(false);
      return;
    }
    try {
      const comp = await fetch('/api/payments/payverse/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, tid: result?.tid ?? null }),
      });
      const cdata = await comp.json().catch(() => ({}));
      if (!comp.ok && !cdata.pending) {
        setError(
          cdata.reason === 'card_blocked'
            ? cdata.refunded
              ? dict.cart.cardBlocked
              : dict.cart.cardBlockedHold
            : dict.cart.payFailed,
        );
        setPlacing(false);
        return;
      }
      // 승인 진행 중(PROCESSING/PENDING)이면 완료 페이지가 '확인 중'으로 안내하고 웹훅이 확정한다.
      purge();
      const query = cdata.ok ? '' : '&pending=1';
      window.location.href = `/${locale}/checkout/success?order=${orderNo}${query}`;
    } catch {
      setError(dict.cart.payFailed);
      setPlacing(false);
    }
  }

  // 계좌이체 모달 열림 동안 ESC 로 닫고 배경 스크롤을 잠근다.
  useEffect(() => {
    if (!transferOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTransferOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [transferOpen]);

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
    <div className="container-band max-w-2xl py-8">
      <h1 className="section-title mb-6">{dict.cart.checkout}</h1>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {/* 통화 토글 — 상세/장바구니와 동일한 표기 통화. 결제는 결제 통화로 진행(아래 합계에 안내). */}
      <CurrencyToggle
        available={availableCurrencies}
        base={baseCur}
        locale={locale}
        className="mb-4"
        hint
      />

      <ul className="divide-y divide-grey-100 border-y border-grey-100">
        {items.map((i) => {
          const ev = details[i.id] ?? null;
          const name = pickI18n(i.name_i18n, locale);
          const img = i.image_url || (ev?.banner ? pickI18n(ev.banner, locale) : '');
          const dateText = ev ? fmtEventDate(ev) : '';
          // 장소는 실제 장소(location/주소)에서만 — meta_i18n(부제일 수 있음)을 📍로 오표기하지 않는다
          const venue = ev
            ? (ev.location ? pickI18n(ev.location, locale) : '') || formatEventAddress(ev.address, locale)
            : '';
          const organizer = ev?.organizer?.name ? pickI18n(ev.organizer.name, locale) : '';
          const unit = pickPrice(i.prices, displayCur) ?? 0;
          return (
            <li key={lineKey(i.id, i.ticketKey)} className="flex gap-4 py-4">
              {/* 썸네일 — 상세 페이지로 이동 */}
              <Link
                href={`/${locale}/products/${i.id}`}
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-grey-100 transition hover:opacity-80 sm:h-24 sm:w-24"
                aria-label={name}
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storageThumb(img, 224)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package size={28} className="text-grey-300" aria-hidden />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                {/* 배지: 판매주체 + 상품유형 */}
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

                <Link
                  href={`/${locale}/products/${i.id}`}
                  className="font-medium leading-snug transition-colors hover:text-primary"
                >
                  {name}
                </Link>
                {i.ticketName && pickI18n(i.ticketName, locale) && (
                  <p className="mt-0.5 text-sm font-medium text-primary">{pickI18n(i.ticketName, locale)}</p>
                )}

                {/* 패스 상세: 일시 · 장소 · 주최자 */}
                {(dateText || venue || organizer) && (
                  <div className="mt-1.5 space-y-1 text-sm text-grey-600">
                    {dateText && (
                      <p className="flex items-start gap-1.5">
                        <CalendarDays size={14} className="mt-0.5 shrink-0 text-grey-400" />
                        <span className="min-w-0 break-words">{dateText}</span>
                      </p>
                    )}
                    {venue && (
                      <p className="flex items-start gap-1.5">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-grey-400" />
                        <span className="min-w-0 break-words">{venue}</span>
                      </p>
                    )}
                    {organizer && (
                      <p className="flex items-start gap-1.5">
                        <User size={14} className="mt-0.5 shrink-0 text-grey-400" />
                        <span className="min-w-0 break-words">{organizer}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* 단가 + 수량 조절 (결제 페이지에서 바로 수정) */}
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-sm text-grey-500">{dispFmt(unit)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(lineKey(i.id, i.ticketKey), i.qty - 1)}
                      disabled={i.qty <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded-pill border border-grey-300 transition hover:bg-grey-100 disabled:opacity-40"
                      aria-label="-"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-7 text-center text-sm tabular-nums">{i.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(lineKey(i.id, i.ticketKey), i.qty + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-pill border border-grey-300 transition hover:bg-grey-100"
                      aria-label="+"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 라인 합계 + 삭제 */}
              <div className="flex shrink-0 flex-col items-end justify-between">
                <p className="text-right font-medium">{dispFmt(unit * i.qty)}</p>
                <button
                  type="button"
                  onClick={() => remove(lineKey(i.id, i.ticketKey))}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-grey-400 transition-colors hover:text-danger"
                  aria-label={dict.cart.remove}
                  title={dict.cart.remove}
                >
                  <Trash2 size={14} />
                  <span className="hidden sm:inline">{dict.cart.remove}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 쿠폰 — 기본 숨김. "할인코드 입력" 버튼을 눌러야 입력란이 나타난다. */}
      <div className="mt-6">
        {!showCoupon ? (
          <button
            type="button"
            onClick={() => setShowCoupon(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-deep"
          >
            <Tag size={15} />
            {dict.cart.couponToggle}
          </button>
        ) : (
          <>
            {/* 헤더 + 닫기 — 닫아도 적용된 할인은 아래 합계에 그대로 반영된다 */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-grey-700">{dict.cart.coupon}</span>
              <button
                type="button"
                onClick={() => setShowCoupon(false)}
                aria-label={dict.cart.close}
                className="text-grey-400 transition-colors hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
            {/* 내 쿠폰함 — 포인트로 교환한 쿠폰을 눌러 바로 적용 */}
            {myCoupons.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs text-grey-500">{dict.cart.myCoupons}</p>
                <div className="flex flex-wrap gap-1.5">
                  {myCoupons.map((mc) => (
                    <button
                      key={mc.id}
                      type="button"
                      onClick={() => void applyCoupon(mc.code)}
                      className={`rounded-pill border px-3 py-1.5 text-xs transition-colors ${
                        applied?.code === mc.code
                          ? 'border-primary bg-primary text-white'
                          : 'border-primary/40 text-primary hover:bg-primary/10'
                      }`}
                    >
                      {mc.coupon.discount_type === 'percent'
                        ? `${mc.coupon.discount_value}%`
                        : formatPrice(
                            { [mc.coupon.currency]: mc.coupon.discount_value } as Prices,
                            mc.coupon.currency as Currency,
                            intlLocale(locale),
                          )}
                      <span className="ml-1.5 font-mono opacity-70">{mc.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder={dict.cart.couponPlaceholder}
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm whitespace-nowrap"
                onClick={() => void applyCoupon()}
              >
                {dict.cart.apply}
              </button>
            </div>
            {couponMsg && (
              <p className={`mt-1.5 text-sm ${applied ? 'text-success' : 'text-danger'}`}>
                {couponMsg}
              </p>
            )}
          </>
        )}
      </div>

      {/* 합계 */}
      <div className="mt-6 space-y-1.5 border-t border-grey-100 pt-4">
        <div className="flex justify-between text-sm text-grey-600">
          <span>{dict.cart.subtotal}</span>
          <span>{dispFmt(subtotalDisp)}</span>
        </div>
        {discountMinor > 0 && (
          <div className="flex items-center justify-between text-sm text-success">
            <span>
              {dict.cart.discount} ({applied?.code})
            </span>
            <span className="flex items-center gap-2">
              {discountPct > 0 && (
                <span className="rounded-pill bg-success/10 px-2 py-0.5 text-xs font-bold tabular-nums text-success">
                  -{discountPct}%
                </span>
              )}
              <span>-{dispFmt(discountDispMinor)}</span>
            </span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="label-caps">{dict.cart.total}</span>
          <span className="font-display text-2xl">{dispFmt(finalDispMinor)}</span>
        </div>
        {isSubDisplay && (
          <p className="text-right text-xs text-grey-400">
            {locale === 'ko'
              ? `실제 결제 ${payFmt(finalMinor)}`
              : `Charged as ${payFmt(finalMinor)}`}
          </p>
        )}
      </div>

      {/* 결제수단은 PayVerse 통합결제창 안에서 고른다 → 여기엔 선택 UI 없음.
          카드는 당분간 받지 않으므로(methods.ts) 간편결제를 고르도록 안내만 한다. */}

      <button
        type="button"
        onClick={() => void pay()}
        disabled={placing || !canCheckout}
        className="btn btn-primary mt-6 w-full"
      >
        {placing
          ? dict.cart.paying
          : isFree
            ? dict.cart.checkoutFree
            : CARD_PAYMENTS_ENABLED
              ? dict.cart.payCard
              : dict.cart.payEasy}
      </button>
      {!canCheckout && (
        <p className="mt-2 text-center text-sm text-grey-500">{dict.cart.payDisabled}</p>
      )}
      {canCheckout && !isFree && !CARD_PAYMENTS_ENABLED && (
        <p className="mt-2 text-center text-sm text-grey-500">{dict.cart.easyPayOnly}</p>
      )}

      {/* ── 계좌이체(대안 결제) — 버튼을 누르면 모달로 계좌정보(KO)/Wise QR(EN) 표시 ── */}
      {showTransfer && (
        <div className="mt-6">
          {/* OR 구분선 */}
          <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-grey-400">
            <span className="h-px flex-1 bg-grey-200" />
            {locale === 'ko' ? '또는' : 'or'}
            <span className="h-px flex-1 bg-grey-200" />
          </div>

          {/* 계좌이체 버튼 — 누르면 모달 오픈 */}
          <button
            type="button"
            onClick={openTransfer}
            className="mt-4 flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1.5 rounded-lg border border-grey-300 bg-white px-4 py-3 text-sm font-semibold text-grey-800 transition-colors hover:border-grey-400 hover:bg-grey-50"
          >
            {useKrwBank ? (
              <>
                <Landmark size={16} className="text-grey-600" />
                계좌이체
              </>
            ) : (
              <>
                {/* 모달 안에서 쓸 수 있는 수단을 버튼에 그대로 미리 보여준다 — Wise + (QR 설정 시)위챗페이 */}
                <span className="inline-flex items-center rounded bg-[#9fe870] px-1.5 py-0.5 font-display text-xs font-extrabold tracking-tight text-[#163300]">
                  Wise
                </span>
                {HAS_WECHAT_QR && <WeChatPayBadge compact />}
                {dict.cart.wiseTransfer}
              </>
            )}
          </button>
        </div>
      )}

      {/* 계좌이체 모달 — 앞으로 떠서 계좌정보/QR·안내를 표시 */}
      {transferOpen && showTransfer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={useKrwBank ? '계좌이체 결제' : 'Wise transfer payment'}
        >
          {/* 배경 — 실수로 닫히지 않도록 클릭해도 닫지 않는다(닫기는 우상단 X 버튼으로만). */}
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" aria-hidden />

          {/* 모달 카드 */}
          <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-4 sm:p-7">
            <button
              type="button"
              onClick={() => setTransferOpen(false)}
              aria-label={dict.cart.close}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-grey-400 transition-colors hover:bg-grey-100 hover:text-ink"
            >
              <X size={18} />
            </button>

            {useKrwBank ? (
              /* ── 국내 계좌이체 / 카카오페이 송금 ── */
              <>
                <div className="flex items-center gap-2 pr-8">
                  <Landmark size={18} className="text-grey-700" />
                  <p className="font-medium text-grey-800">계좌이체 · 카카오페이 송금</p>
                </div>

                <div className="mt-5 space-y-3">
                  {/* 카카오페이 송금 (먼저) — QR 스캔 또는 버튼으로 송금 링크 이동 */}
                  <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-[#FEE500] px-2 py-0.5 font-display text-xs font-extrabold tracking-tight text-[#3C1E1E]">
                        kakao pay
                      </span>
                      <p className="font-display text-base font-bold tracking-tight">카카오페이 송금</p>
                    </div>
                    <div className="mt-3 flex flex-col items-center gap-3 border-t border-grey-200 pt-4 sm:flex-row sm:gap-4">
                      {/* QR */}
                      <div className="shrink-0 rounded-lg bg-white p-2 ring-1 ring-grey-200">
                        <QRCode value={KAKAOPAY_URL} size={104} level="M" title="KakaoPay QR" />
                      </div>
                      {/* 안내 + 송금 버튼 */}
                      <div className="min-w-0 flex-1 text-center sm:text-left">
                        <p className="text-xs text-grey-500">
                          QR을 스캔하거나 버튼을 눌러 카카오페이로 송금하세요.
                        </p>
                        <a
                          href={KAKAOPAY_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FEE500] px-4 py-2.5 text-sm font-bold text-[#3C1E1E] transition-opacity hover:opacity-90 sm:w-auto"
                        >
                          카카오페이로 송금하기
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* OR / 또는 구분선 */}
                  <div className="flex items-center gap-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-grey-400">
                    <span className="h-px flex-1 bg-grey-300" />
                    OR
                    <span className="h-px flex-1 bg-grey-300" />
                  </div>

                  {/* 우리은행 무통장입금 (아래) */}
                  <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
                    <p className="font-display text-lg font-bold tracking-tight">{KRW_BANK.bank}</p>
                    <p className="mt-0.5 text-sm text-grey-500">
                      예금주 <span className="font-medium text-grey-700">{KRW_BANK.holder}</span>
                    </p>
                    <p className="text-xs text-grey-400">{KRW_BANK.accountName}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-grey-200 pt-3">
                      <span className="select-all font-display text-lg tabular-nums tracking-tight">
                        {KRW_BANK.accountNo}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(KRW_BANK.accountNo.replace(/-/g, ''), 'account')}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-grey-300 px-2.5 py-1.5 text-xs font-medium text-grey-700 transition-colors hover:border-grey-400 hover:bg-grey-100"
                      >
                        {copiedKey === 'account' ? (
                          <Check size={14} className="text-success" />
                        ) : (
                          <Copy size={14} />
                        )}
                        {copiedKey === 'account' ? '복사됨' : '복사'}
                      </button>
                    </div>
                  </div>

                  {/* 보낼 금액 */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="label-caps text-grey-400">보낼 금액</span>
                    <span className="font-display text-xl">{dispFmt(finalDispMinor)}</span>
                  </div>

                  {/* 안내 — 주문자명 + 수동 확인 */}
                  <div className="rounded-lg bg-cream px-3 py-2.5 text-xs leading-relaxed text-grey-600 ring-1 ring-beige">
                    입금·송금 시 <b className="font-semibold text-grey-800">주문자 이름</b>을 남겨 주세요.
                    계좌이체·카카오페이 송금은 자동으로 확인되지 않으며, 입금이 확인되면 담당자가 직접
                    확인 후 주문(티켓)을 발급해 드립니다. 확인까지 영업일 기준 다소 시간이 걸릴 수 있으며,
                    결제 완료 화면이 바로 표시되지 않아도 정상이니 안심하세요.
                  </div>
                </div>
              </>
            ) : (
              /* ── 해외: Wise 송금 + 외화계좌 SWIFT 국제송금 ── */
              <>
                <div className="flex items-center gap-2 pr-8">
                  <Landmark size={18} className="text-grey-700" />
                  <p className="font-medium text-grey-800">Pay by transfer</p>
                </div>

                <div className="mt-5 space-y-3">
                  {/* Wise 송금 (먼저) */}
                  <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-[#9fe870] px-2 py-0.5 font-display text-xs font-extrabold tracking-tight text-[#163300]">
                        Wise
                      </span>
                      <p className="font-display text-base font-bold tracking-tight">Wise transfer</p>
                    </div>
                    <div className="mt-3 flex flex-col items-center gap-3 border-t border-grey-200 pt-4 sm:flex-row sm:gap-4">
                      {/* QR */}
                      <div className="shrink-0 rounded-lg bg-white p-2 ring-1 ring-grey-200">
                        <QRCode value={wiseUrl} size={104} fgColor="#163300" level="M" title="Wise payment QR" />
                      </div>
                      {/* 안내 + 송금 버튼 */}
                      <div className="min-w-0 flex-1 text-center sm:text-left">
                        <p className="text-xs text-grey-500">
                          Scan the QR or tap the button to open the Wise payment page.
                        </p>
                        <a
                          href={wiseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#9fe870] px-4 py-2.5 text-sm font-bold text-[#163300] transition-colors hover:bg-[#8fdc5f] sm:w-auto"
                        >
                          Pay with Wise
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                    {/* 보낼 금액 — 위챗 블록과 같은 위치에 병기(맨 아래까지 스크롤하지 않아도 확인) */}
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-grey-200 pt-3">
                      <span className="label-caps shrink-0 text-grey-400">Amount to send</span>
                      <span className="font-display text-xl">{dispFmt(finalDispMinor)}</span>
                    </div>
                  </div>

                  {/* 위챗페이 QR (Wise 아래) — QR 이미지가 없으면 구분선까지 함께 숨겨진다 */}
                  <WeChatPayBlock
                    amountMinor={finalDispMinor}
                    currency={displayCur}
                    amountText={dispFmt(finalDispMinor)}
                  />

                  {/* OR / 또는 구분선 */}
                  <div className="flex items-center gap-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-grey-400">
                    <span className="h-px flex-1 bg-grey-300" />
                    OR
                    <span className="h-px flex-1 bg-grey-300" />
                  </div>

                  {/* 외화계좌 SWIFT 국제송금 (아래) */}
                  <div className="rounded-xl bg-grey-50 p-4 ring-1 ring-grey-200">
                    <div className="flex items-center gap-2">
                      <Landmark size={16} className="text-grey-600" />
                      <p className="font-display text-base font-bold tracking-tight">
                        International wire (SWIFT)
                      </p>
                    </div>
                    <dl className="mt-3 space-y-2 border-t border-grey-200 pt-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">Bank</dt>
                        <dd className="text-right font-medium">{FX_BANK.bank}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">SWIFT / BIC</dt>
                        <dd className="flex items-center gap-2">
                          <span className="select-all font-medium tabular-nums">{FX_BANK.swift}</span>
                          <button
                            type="button"
                            onClick={() => copyText(FX_BANK.swift, 'swift')}
                            aria-label="Copy SWIFT"
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-grey-300 p-1 text-grey-600 transition-colors hover:border-grey-400 hover:bg-grey-100"
                          >
                            {copiedKey === 'swift' ? (
                              <Check size={13} className="text-success" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">Account No.</dt>
                        <dd className="flex items-center gap-2">
                          <span className="select-all font-medium tabular-nums">
                            {FX_BANK.accountNo}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyText(FX_BANK.accountNo.replace(/-/g, ''), 'fx')}
                            aria-label="Copy account number"
                            className="inline-flex shrink-0 items-center justify-center rounded-md border border-grey-300 p-1 text-grey-600 transition-colors hover:border-grey-400 hover:bg-grey-100"
                          >
                            {copiedKey === 'fx' ? (
                              <Check size={13} className="text-success" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">Beneficiary</dt>
                        <dd className="text-right font-medium">{FX_BANK.holder}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-grey-500">Currency</dt>
                        <dd className="text-right font-medium">{FX_BANK.currency}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* 보낼 금액 */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="label-caps text-grey-400">Amount to send</span>
                    <span className="font-display text-xl">{dispFmt(finalDispMinor)}</span>
                  </div>

                  {/* 안내 — 참조 + 수동 확인 */}
                  <div className="rounded-lg bg-cream px-3 py-2.5 text-xs leading-relaxed text-grey-600 ring-1 ring-beige">
                    Add your <b className="font-semibold text-grey-800">account email</b> to the
                    payment reference so we can match your order. Wise and bank transfers are confirmed
                    manually — not automatically. Once your payment arrives, our team verifies it and
                    issues your ticket, which may take some time on business days. You won’t see an
                    instant confirmation screen, and that’s expected.
                  </div>
                </div>
              </>
            )}

            {/* 송금 완료 알림 — 고객이 송금 후 눌러 운영자에게 알림 발송 */}
            <div className="mt-5 border-t border-grey-200 pt-4">
              {notifyState === 'sent' ? (
                <p className="rounded-lg bg-success/10 px-3 py-2.5 text-center text-sm font-medium text-success">
                  {locale === 'ko'
                    ? '알림을 보냈어요. 입금 확인 후 담당자가 티켓을 발급해 드립니다.'
                    : 'Thanks! We’ve notified our team and will issue your ticket after confirming your payment.'}
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={notifyTransfer}
                    disabled={notifyState === 'sending'}
                    className="btn btn-primary w-full disabled:opacity-60"
                  >
                    {notifyState === 'sending'
                      ? locale === 'ko'
                        ? '전송 중…'
                        : 'Sending…'
                      : locale === 'ko'
                        ? '송금 완료했어요 · 알림 보내기'
                        : 'I’ve paid — notify the team'}
                  </button>
                  {notifyState === 'error' && (
                    <p className="mt-2 text-center text-sm text-danger">
                      {locale === 'ko'
                        ? '알림 전송에 실패했어요. 잠시 후 다시 시도해 주세요.'
                        : 'Failed to send. Please try again.'}
                    </p>
                  )}
                  <p className="mt-2 text-center text-xs text-grey-400">
                    {locale === 'ko'
                      ? '송금을 완료하신 뒤 눌러 주세요.'
                      : 'Tap after you’ve completed the transfer.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
