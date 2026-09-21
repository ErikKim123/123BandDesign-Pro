// Design Ref: §5 Phase 4 — 내 주문내역 탭 (고객 전용 가드, 본인 주문 + 항목 + 상품명)
// 공통 헤더(캐릭터/QR)와 탭 네비는 account/layout.tsx 가 그린다 — 여기선 본문만.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Truck, Package, MapPin, CalendarDays, Gift, Ticket as TicketIcon } from 'lucide-react';
import {
  pickI18n,
  formatEventAddress,
  resolveOrderPass,
  toDisplayAmount,
  type Currency,
  type EventContent,
  type Locale,
} from '@123band/shared';
import { intlLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n/dictionaries';
import { requireCustomer } from '@/lib/auth/guard';
import { getMyOrders } from '@/lib/queries/orders';
import { getReceivedPasses } from '@/lib/queries/gifts';
import { getWiseCheckoutUrl } from '@/lib/payments/wise';
import { OrderCheckinQr } from '@/components/account/OrderCheckinQr';
import { OrderCheckinSync } from '@/components/account/OrderCheckinSync';
import { OrderDeleteButton } from '@/components/account/OrderDeleteButton';
import { OrderTransferModal } from '@/components/account/OrderTransferModal';
import { storageThumb } from '@/lib/image';

// 입장확인 QR 은 '오거나이저 포털'의 체크인 페이지를 가리킨다(웹엔 /checkin 라우트가 없음).
// 폰 기본 카메라로 찍으면 파트너 포털의 /checkin?order=<id> 가 열려 자동 처리된다.
const PARTNER_URL = process.env.NEXT_PUBLIC_PARTNER_URL ?? 'https://123band-partner.vercel.app';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10; // 최근 주문 10개씩 — 나머지는 다음 페이지로

export default async function MyOrdersPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string | string[] };
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);

  // 세션 분리 규칙: web 은 고객 전용 (admin/partner 계정 차단)
  await requireCustomer(locale, 'account/orders');

  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const { orders, total } = await getMyOrders({ page, pageSize: PAGE_SIZE });
  // 선물받아(claim) 내 소유가 된 패스 — 주문내역 상단에 별도 섹션으로. 첫 페이지에만 노출.
  const receivedPasses = page === 1 ? await getReceivedPasses() : [];
  // Wise 송금 링크(어드민 설정) — 입금 확인 대기 주문의 재결제 모달에서 사용. 미설정이면 SWIFT만 노출.
  const wiseUrl = await getWiseCheckoutUrl();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // 범위 밖 페이지(수기 URL/오래된 링크) → 마지막 유효 페이지로. 빈 화면·이상한 페이지네이션 방지.
  if (total > 0 && page > totalPages) {
    redirect(`/${locale}/account/orders?page=${totalPages}`);
  }

  // 입장 미소진(checked_in_count < qty) 티켓 항목 — 이 항목의 카운트가 오르면 자동 새로고침.
  // 스캔마다 -1 되므로 현재 카운트를 기준(baseline)으로 함께 넘긴다.
  const pendingCheckins = orders.flatMap((o) =>
    o.order_items
      .filter((it) => it.products?.product_type === 'ticket' && (it.checked_in_count ?? 0) < it.qty)
      .map((it) => ({ id: it.id, count: it.checked_in_count ?? 0 })),
  );

  // 주문의 티켓 입장 집계 — admitted(입장 처리 수) / total(총 입장 가능 수).
  const admissionOf = (o: (typeof orders)[number]) => {
    const tickets = o.order_items.filter((it) => it.products?.product_type === 'ticket');
    return {
      admitted: tickets.reduce((s, it) => s + (it.checked_in_count ?? 0), 0),
      total: tickets.reduce((s, it) => s + it.qty, 0),
    };
  };

  const fmt = (minor: number, currency: string) =>
    new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency: currency as Currency,
      // USD 만 센트(2자리), KRW·서브통화(THB 등)는 정수. (서브통화 최소단위=정수)
      minimumFractionDigits: currency === 'USD' ? 2 : 0,
    }).format(toDisplayAmount(minor, currency as Currency));

  // 표시 통화(서브통화) 병기 — display_* 가 있으면 그 통화/금액으로 표기(고객이 결제한 통화), 없으면 결제 통화.
  const orderCurrency = (o: (typeof orders)[number]) => o.display_currency ?? o.currency;
  const orderTotal = (o: (typeof orders)[number]) => o.display_total ?? o.total_amount;
  // 라인 금액도 표시 통화로 — 표시총액/결제총액 비율로 안분(단일 항목이면 정확, 다항목이면 근사).
  const fmtLine = (o: (typeof orders)[number], lineMinor: number, lineCurrency: string) =>
    o.display_currency && o.display_total != null && o.total_amount > 0
      ? fmt(Math.round((lineMinor * o.display_total) / o.total_amount), o.display_currency)
      : fmt(lineMinor, lineCurrency);

  // 행사 티켓 장소 — 자유 텍스트(location) 우선, 없으면 구조화 주소 한 줄
  const venueText = (ev?: EventContent | null) =>
    ev ? pickI18n(ev.location, locale) || formatEventAddress(ev.address, locale) : '';

  // 행사 일시 — datetime-local(TZ 없음)은 KST 절대시각으로 고정해 서버=클라 일치
  const eventDateText = (ev?: EventContent | null) => {
    if (!ev?.startAt) return '';
    const toKst = (iso: string) => new Date(/[+Z]/.test(iso) ? iso : `${iso}+09:00`);
    const fmtDt = (iso?: string) => {
      if (!iso) return '';
      const d = toKst(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return new Intl.DateTimeFormat(intlLocale(locale), {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul',
      }).format(d);
    };
    return `${fmtDt(ev.startAt)}${ev.endAt ? ` ~ ${fmtDt(ev.endAt)}` : ''}`;
  };

  // 행사 종료 시각(ms) — endAt 없으면 startAt 기준. TZ 없는 datetime-local 은 위 표기와 같은 규칙으로 KST 해석.
  // 날짜만 있는 값(2026-11-02)은 그날이 다 지나야 종료로 본다.
  const eventEndMs = (ev?: EventContent | null) => {
    const raw = ev?.endAt || ev?.startAt;
    if (!raw) return null;
    const iso = /[+Z]/.test(raw)
      ? raw
      : raw.includes('T')
        ? `${raw}+09:00`
        : `${raw}T23:59:59+09:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  };
  // '지나간 행사' 판정 기준 시각 — force-dynamic 이라 요청 시각으로 매번 새로 계산된다.
  const nowMs = Date.now();

  // 입장(체크인) 시각 — 연·월·일 + 시:분:초 까지(KST). checked_in_at 은 오프셋 포함 timestamptz.
  const checkinTimeText = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(intlLocale(locale), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    }).format(d);
  };

  // 주문 날짜 — 월 그룹과 동일하게 KST 기준으로 표기(경계에서 헤더와 불일치 방지). ISO 형태 유지.
  const orderDateText = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Seoul',
    }).format(d);
  };

  const statusLabel = (s: string) =>
    (dict.orders.status as Record<string, string>)[s] ?? s;
  const shipStatus = (s: string) =>
    (dict.shipping.status as Record<string, string>)[s] ?? s;
  const regionLabel = (r: string) =>
    r === 'overseas' ? dict.shipping.overseas : dict.shipping.domestic;

  // 월 단위 그룹 — 오래된 주문을 기간(월)으로 묶어 보여준다. created_at 은 KST 기준으로 판정.
  const monthKeyOf = (iso: string) => {
    const p = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      timeZone: 'Asia/Seoul',
    }).formatToParts(new Date(iso));
    return `${p.find((x) => x.type === 'year')?.value}-${p.find((x) => x.type === 'month')?.value}`;
  };
  const monthLabelOf = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      year: 'numeric',
      month: 'long',
      timeZone: 'Asia/Seoul',
    }).format(new Date(iso));

  // 최신순이라 같은 달은 연속 → 마지막 그룹만 비교해 이어붙인다.
  const monthGroups: { key: string; label: string; orders: typeof orders }[] = [];
  for (const o of orders) {
    const key = monthKeyOf(o.created_at);
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.key === key) last.orders.push(o);
    else monthGroups.push({ key, label: monthLabelOf(o.created_at), orders: [o] });
  }

  return (
    <div>
      {/* 오거나이저가 QR 스캔(-1)하면 자동으로 새로고침 → 남은 입장 수 즉시 반영 */}
      <OrderCheckinSync pendingItems={pendingCheckins} />

      {/* 선물받은 패스 — 선물함에서 '내 주문으로 이동'한 패스. 각 패스별 회전형 시크릿 QR. */}
      {receivedPasses.length > 0 && (
        <section className="mb-10">
          <div className="mb-1 flex items-center gap-2">
            <Gift size={18} className="text-primary" />
            <h2 className="font-display text-xl">{dict.gifts.receivedSectionTitle}</h2>
          </div>
          <p className="mb-4 text-sm text-grey-500">{dict.gifts.receivedSectionHint}</p>
          <ul className="space-y-5">
            {receivedPasses.map((card) => {
              const name = pickI18n(card.product?.name_i18n ?? card.nameI18n, locale) || '—';
              const ev = card.product?.event_content;
              const href = card.product?.id ? `/${locale}/products/${card.product.id}` : null;
              const thumbClass =
                'flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-grey-100 sm:h-28 sm:w-28';
              const thumb = card.product?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={storageThumb(card.product.image_url, 256)} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package size={32} className="text-grey-300" aria-hidden />
              );
              return (
                <li
                  key={card.giftId}
                  className="rounded-xl border border-grey-200 bg-white p-5 shadow-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grey-100 pb-3">
                    <span className="font-mono text-xs text-grey-500">{card.orderNo}</span>
                    <span className="inline-flex items-center gap-1 rounded-pill bg-cream px-2.5 py-0.5 text-xs font-semibold text-primary">
                      <Gift size={12} /> {dict.gifts.receivedBadge}
                    </span>
                  </div>

                  {/* 패스 정보 — 썸네일 / 상품명 / 장소 / 일시 (일반 주문 항목과 동일) */}
                  <div className="flex items-center gap-3 py-3 text-sm">
                    {href ? (
                      <Link href={href} className={`${thumbClass} transition hover:opacity-80`} aria-label={name}>
                        {thumb}
                      </Link>
                    ) : (
                      <div className={thumbClass}>{thumb}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-grey-900">
                        {href ? (
                          <Link href={href} className="transition-colors hover:text-primary">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </p>
                      {venueText(ev) && (
                        <p className="mt-1 flex items-center gap-1.5 text-grey-600">
                          <MapPin size={14} className="shrink-0 text-grey-400" />
                          <span className="truncate">{venueText(ev)}</span>
                        </p>
                      )}
                      {eventDateText(ev) && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-grey-600">
                          <CalendarDays size={14} className="shrink-0 text-grey-400" />
                          <span className="truncate">{eventDateText(ev)}</span>
                        </p>
                      )}
                      {card.senderName && (
                        <p className="mt-1 text-xs text-grey-400">
                          {dict.gifts.from} <span className="text-grey-600">{card.senderName}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {card.passes.map((p, i) => (
                    <OrderCheckinQr
                      key={p.secret}
                      value={`${PARTNER_URL}/checkin?pass=${p.secret}`}
                      orderNo={card.orderNo ?? ''}
                      label={dict.orders.checkinQr}
                      hint={dict.orders.checkinHint}
                      admitted={p.used ? 1 : 0}
                      total={1}
                      unitLabel={card.passes.length > 1 ? `${i + 1} / ${card.passes.length}` : undefined}
                      checkedInLabel={dict.orders.checkedIn}
                      checkedInHint={dict.orders.checkedInHint}
                      admissionsLabel={dict.orders.admissions}
                      remainingLabel={dict.orders.remaining}
                    />
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {total === 0 && receivedPasses.length === 0 ? (
        <p className="py-16 text-center text-grey-400">{dict.orders.empty}</p>
      ) : (
        <>
          <div className="space-y-10">
            {monthGroups.map((g) => (
              <section key={g.key}>
                {/* 월 구간 헤더 — 결제 건 사이를 월 단위로 구분해 가독성↑
                    (페이지 단위 그룹이라 월 전체 건수를 오인시킬 수 있어 개수는 표기하지 않는다) */}
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="whitespace-nowrap text-sm font-semibold text-grey-600">{g.label}</h2>
                  <span className="h-px flex-1 bg-grey-100" />
                </div>
                <ul className="space-y-5">
                  {g.orders.map((o) => {
                    const adm = admissionOf(o);
                    // 티켓은 '내가 현재 소유한 패스' 1장 = 1개 QR 로 펼친다. 선물한 패스는 owner 가 바뀌어 빠진다.
                    // QR 값 = 패스의 회전형 시크릿(고정 order_id 아님) → 선물 시 이전 소유자 캡처본 무효.
                    const ticketItems = o.order_items.filter(
                      (it) => it.products?.product_type === 'ticket',
                    );
                    // 활성(내 사용권) 패스 = valid/used. QR 로 펼친다.
                    const ticketUnits = ticketItems.flatMap((it) => {
                      const owned = (it.passes ?? []).filter((p) => p.status !== 'gifting');
                      return owned.map((p, k) => ({
                        key: p.id,
                        secret: p.redemption_secret,
                        admitted: p.status !== 'valid', // 사용(입장완료)/무효면 소진 표시
                        unitLabel: owned.length > 1 ? `${k + 1} / ${owned.length}` : undefined,
                        checkedInAt: p.used_at,
                      }));
                    });
                    // 선물로 넘긴 패스 — 비활성 표시. 'gifting'=수락 대기(내 소유·예약),
                    // 양도완료=받는이가 수락해 소유권 이전됨(내 임베드에서 빠짐 = qty - 내소유수).
                    const giftedUnits = ticketItems.flatMap((it) => {
                      const passes = it.passes ?? [];
                      const pending = passes.filter((p) => p.status === 'gifting');
                      const transferredAway = Math.max(0, it.qty - passes.length);
                      return [
                        ...pending.map((p) => ({ key: p.id, kind: 'pending' as const })),
                        ...Array.from({ length: transferredAway }, (_, i) => ({
                          key: `${it.id}-t${i}`,
                          kind: 'transferred' as const,
                        })),
                      ];
                    });
                    // 내가 가진 티켓 패스를 전부 사용(입장)했는지 — 삭제(숨김) 버튼 노출 판정.
                    const used = ticketUnits.length > 0 && ticketUnits.every((u) => u.admitted);
                    // 결제 확인(paid 이상)된 주문만 입장 QR 노출. 입금 확인 대기면 재결제/재요청 패널, 취소/환불이면 QR 없음.
                    const confirmed = ['paid', 'shipped', 'done'].includes(o.status);
                    const awaiting = o.status === 'awaiting_payment';
                    // 지나간 행사 — 주문에 걸린 행사들의 종료시각이 전부 과거면 더 쓸 일이 없으므로 삭제 허용.
                    const eventEnds = o.order_items
                      .map((it) => eventEndMs(it.products?.event_content))
                      .filter((ms): ms is number => ms != null);
                    const eventEnded = eventEnds.length > 0 && eventEnds.every((ms) => ms < nowMs);
                    // 행사 일정이 아예 없는 주문(굿즈 없는 기타/상품이 삭제된 과거 주문)도 정리할 수 있게 한다.
                    // 배송 대상(physical)이 섞여 있으면 배송 추적을 잃을 수 있어 제외.
                    const hasPhysical = o.order_items.some(
                      (it) => it.products?.product_type === 'physical',
                    );
                    const canDelete = used || eventEnded || (eventEnds.length === 0 && !hasPhysical);
                    return (
                    <li
                      key={o.id}
                      className="rounded-xl border border-grey-200 bg-white p-5 shadow-1 transition-shadow hover:shadow-2"
                    >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grey-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{o.order_no}</span>
                  <span className="rounded-pill bg-grey-100 px-2.5 py-1 text-xs font-medium text-grey-600">
                    {statusLabel(o.status)}
                  </span>
                </div>
                <time className="text-xs text-grey-400">{orderDateText(o.created_at)}</time>
              </div>

              <ul className="py-3 text-sm">
                {o.order_items.map((it) => {
                  const href = it.products?.id ? `/${locale}/products/${it.products.id}` : null;
                  const thumb = (
                    <>
                      {it.products?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={storageThumb(it.products.image_url, 256)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package size={32} className="text-grey-300" aria-hidden />
                      )}
                    </>
                  );
                  const thumbClass =
                    'flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-grey-100 sm:h-28 sm:w-28';
                  const name = pickI18n(it.products?.name_i18n, locale) || '—';
                  // 어떤 패스(풀/파티 등)를 샀는지. 주문에 저장돼 있으면 그대로 쓰고,
                  // 0042 이전 주문이면 단가로 역추적한다(단가가 한 패스에만 맞을 때만 반환).
                  const pass = resolveOrderPass(it.products?.event_content?.tickets, {
                    ticketKey: it.ticket_key,
                    ticketName: it.ticket_name_i18n,
                    unitPrice: it.unit_price,
                    currency: it.currency as Currency,
                  });
                  const passName = pass
                    ? pickI18n(pass.name, locale) || pickI18n(pass.name, 'en')
                    : '';
                  return (
                  <li key={it.id} className="flex items-center gap-3 py-2">
                    {/* 상품/패스 썸네일 — 클릭 시 상세 페이지로 이동 */}
                    {href ? (
                      <Link href={href} className={`${thumbClass} transition hover:opacity-80`} aria-label={name}>
                        {thumb}
                      </Link>
                    ) : (
                      <div className={thumbClass}>{thumb}</div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-grey-900">
                        {href ? (
                          <Link href={href} className="transition-colors hover:text-primary">
                            {name} × {it.qty}
                          </Link>
                        ) : (
                          <>
                            {name} × {it.qty}
                          </>
                        )}
                      </p>
                      {/* 구매한 패스 — 행사명만으로는 풀패스인지 파티패스인지 알 수 없다 */}
                      {passName && (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-pill bg-cream px-2 py-0.5 text-xs font-semibold text-primary-deep">
                            <TicketIcon size={12} aria-hidden />
                            {passName}
                          </span>
                          {pass?.tierLabel && (
                            <span className="text-xs text-grey-500">{pass.tierLabel}</span>
                          )}
                        </p>
                      )}
                      {venueText(it.products?.event_content) && (
                        <p className="mt-1 flex items-center gap-1.5 text-grey-600">
                          <MapPin size={14} className="shrink-0 text-grey-400" />
                          <span className="truncate">{venueText(it.products?.event_content)}</span>
                        </p>
                      )}
                      {eventDateText(it.products?.event_content) && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-grey-600">
                          <CalendarDays size={14} className="shrink-0 text-grey-400" />
                          <span className="truncate">{eventDateText(it.products?.event_content)}</span>
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 self-start text-grey-700">{fmtLine(o, it.line_amount, it.currency)}</span>
                  </li>
                  );
                })}
              </ul>

              {/* 입장 확인 QR — 결제 확인(paid 이상) 주문만 노출. 입금 확인 대기면 QR 대신 재결제/재요청 패널,
                  취소/환불이면 아무것도 노출하지 않는다. (티켓은 '내 소유 패스' 1장씩 개별 QR = 회전형 시크릿) */}
              {confirmed ? (
                ticketItems.length > 0 ? (
                <div>
                  {ticketUnits.map((u) => (
                    <OrderCheckinQr
                      key={u.key}
                      value={`${PARTNER_URL}/checkin?pass=${u.secret}`}
                      orderNo={o.order_no}
                      label={dict.orders.checkinQr}
                      hint={dict.orders.checkinHint}
                      admitted={u.admitted ? 1 : 0}
                      total={1}
                      unitLabel={u.unitLabel}
                      checkedInLabel={dict.orders.checkedIn}
                      checkedInHint={dict.orders.checkedInHint}
                      checkedInAtLabel={dict.orders.checkedInAt}
                      admissionsLabel={dict.orders.admissions}
                      remainingLabel={dict.orders.remaining}
                      checkedInAtText={u.admitted ? checkinTimeText(u.checkedInAt) : ''}
                    />
                  ))}
                  {/* 선물로 넘긴 패스 — 비활성(양도됨/수락대기). QR 없음 + 양도 후 사용 시 법적 책임 안내. */}
                  {giftedUnits.map((u) => (
                    <div
                      key={u.key}
                      className="flex items-center gap-4 border-t border-grey-100 py-4 opacity-70"
                    >
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-grey-300 bg-grey-50 sm:h-24 sm:w-24">
                        <Gift size={26} className="text-grey-400" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold ${
                            u.kind === 'transferred'
                              ? 'bg-grey-200 text-grey-600'
                              : 'bg-cream text-primary'
                          }`}
                        >
                          <Gift size={12} />
                          {u.kind === 'transferred' ? dict.orders.gifted : dict.orders.giftPending}
                        </span>
                        <p className="mt-1 break-all font-mono text-[11px] text-grey-400">{o.order_no}</p>
                        {/* 법적 책임 안내 (작게) */}
                        <p className="mt-1 text-[11px] leading-snug text-grey-400">{dict.orders.giftedNote}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <OrderCheckinQr
                  value={`${PARTNER_URL}/checkin?order=${o.id}`}
                  orderNo={o.order_no}
                  label={dict.orders.checkinQr}
                  hint={dict.orders.checkinHint}
                  admitted={adm.admitted}
                  total={adm.total}
                  checkedInLabel={dict.orders.checkedIn}
                  checkedInHint={dict.orders.checkedInHint}
                  checkedInAtLabel={dict.orders.checkedInAt}
                  admissionsLabel={dict.orders.admissions}
                  remainingLabel={dict.orders.remaining}
                  checkedInAtText={checkinTimeText(
                    // 최초 입장 시각 — 항목들의 checked_in_at(각 항목 최초 스캔) 중 가장 이른 값
                    o.order_items.reduce(
                      (m, it) => (it.checked_in_at && (!m || it.checked_in_at < m) ? it.checked_in_at : m),
                      '',
                    ),
                  )}
                />
                )
              ) : awaiting ? (
                <OrderTransferModal
                  orderId={o.id}
                  amountText={fmt(orderTotal(o), orderCurrency(o))}
                  amountMinor={orderTotal(o)}
                  amountCurrency={orderCurrency(o) as Currency}
                  locale={locale}
                  dict={dict}
                  wiseUrl={wiseUrl}
                />
              ) : null}

              {/* 배송 정보 */}
              {o.shipments[0] ? (
                <div className="border-t border-grey-100 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Truck size={14} className="text-grey-400" />
                    <span className="label-caps">{dict.shipping.title}</span>
                    <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-xs font-medium text-grey-600">
                      {shipStatus(o.shipments[0].status)}
                    </span>
                    <span className="text-xs text-grey-400">{regionLabel(o.shipments[0].region)}</span>
                  </div>
                  {o.shipments[0].tracking_no && (
                    <p className="mt-1 text-grey-600">
                      {dict.shipping.carrier}: {o.shipments[0].carrier || '—'} · {dict.shipping.tracking}:{' '}
                      {o.shipments[0].tracking_no}
                    </p>
                  )}
                  {o.shipments[0].eta && (
                    <p className="text-grey-500">
                      {dict.shipping.eta}: {String(o.shipments[0].eta).slice(0, 10)}
                    </p>
                  )}
                </div>
              ) : o.order_items.some((it) => it.products?.product_type === 'physical') ? (
                <div className="border-t border-grey-100 py-3 text-sm text-grey-400">
                  {dict.shipping.none}
                </div>
              ) : null}

              <div className="flex items-center justify-between border-t border-grey-100 pt-3">
                <span className="label-caps">{dict.cart.total}</span>
                <span className="font-display text-lg">{fmt(orderTotal(o), orderCurrency(o))}</span>
              </div>

              {/* 삭제(=구매자 뷰에서만 숨김) — 입장 완료 또는 행사가 끝난 주문에만 노출.
                  판매자/정산 기록은 hide_order RPC 가 건드리지 않는다. */}
              {canDelete && (
                <div className="flex justify-end pt-3">
                  <OrderDeleteButton
                    orderId={o.id}
                    label={dict.orders.delete}
                    confirmText={dict.orders.deleteConfirm}
                    failedText={dict.orders.deleteFailed}
                    deletingLabel={dict.orders.deleting}
                  />
                </div>
              )}
                    </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {/* 페이지네이션 — 최근 10개씩, 나머지는 다음 페이지 */}
          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3">
              {page > 1 ? (
                <Link
                  href={`/${locale}/account/orders?page=${page - 1}`}
                  className="btn btn-secondary btn-sm"
                >
                  ‹ {dict.orders.prevPage}
                </Link>
              ) : (
                <span className="btn btn-secondary btn-sm cursor-not-allowed opacity-40" aria-disabled>
                  ‹ {dict.orders.prevPage}
                </span>
              )}
              <span className="min-w-16 text-center text-sm text-grey-500">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={`/${locale}/account/orders?page=${page + 1}`}
                  className="btn btn-secondary btn-sm"
                >
                  {dict.orders.nextPage} ›
                </Link>
              ) : (
                <span className="btn btn-secondary btn-sm cursor-not-allowed opacity-40" aria-disabled>
                  {dict.orders.nextPage} ›
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
