// Design Ref: §5.4 주문관리 — 주문 상세(읽기전용) 정보 패널.
// 목록 행에는 없는 상세(연락처·주문일시·상품 내역·배송)를 order id 로 별도 조회해 표시.
'use client';
import { useQuery } from '@tanstack/react-query';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from '@/lib/locale/LocaleContext';
import {
  pickI18n,
  resolveOrderPass,
  type Currency,
  type EventContent,
  type I18n,
} from '@123band/shared';
import { formatAmount } from '@/lib/resource/configs/orders';

interface OrderItem {
  qty: number;
  unit_price: number;
  line_amount: number;
  currency: string;
  // 구매한 패스(티켓 티어) — 0042 이후 주문에만 있다. 이전 주문은 단가로 역추적한다.
  ticket_key?: string | null;
  ticket_name_i18n?: I18n | null;
  product: { name_i18n: I18n; code: string | null; event_content: EventContent | null } | null;
  seller: {
    name: string | null;
    email: string | null;
    partners: { company_name: string | null }[] | null;
  } | null;
}

interface OrderDetailData {
  order_no: string;
  status: string;
  total_amount: number;
  currency: string;
  // 표시 전용(서브통화) 병기 — 고객이 바트 등으로 송금한 경우. 없으면(폴백/미해당) canonical 사용.
  display_currency?: string | null;
  display_total?: number | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string | null;
  buyer: { name: string | null; email: string | null; phone: string | null; country: string | null } | null;
  order_items: OrderItem[] | null;
  shipments:
    | {
        region: string;
        carrier: string | null;
        tracking_no: string | null;
        status: string;
        shipped_at: string | null;
        eta: string | null;
        cost: number;
      }[]
    | null;
}

// 마이그레이션이 아직 안 올라간 환경에서도 상세는 열려야 한다 → 선택 컬럼을 단계적으로 떼며 재시도한다.
// display: 표시 통화 병기(0034) · ticket: 구매 패스(0042).
function buildSelect(opts: { display: boolean; ticket: boolean }): string {
  return (
    'order_no, status, total_amount, currency, ' +
    (opts.display ? 'display_currency, display_total, ' : '') +
    'payment_method, created_at, updated_at, ' +
    'buyer:profiles!buyer_id(name, email, phone, country), ' +
    'order_items(qty, unit_price, line_amount, currency, ' +
    (opts.ticket ? 'ticket_key, ticket_name_i18n, ' : '') +
    'product:products!product_id(name_i18n, code, event_content), ' +
    'seller:profiles!seller_id(name, email, partners(company_name))), ' +
    'shipments(region, carrier, tracking_no, status, shipped_at, eta, cost)'
  );
}
const SELECT_STEPS = [
  buildSelect({ display: true, ticket: true }),
  buildSelect({ display: true, ticket: false }),
  buildSelect({ display: false, ticket: false }),
];

const REGION_NAMES = (() => {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' });
  } catch {
    return null;
  }
})();
function countryLabel(code: string | null): string {
  const c = (code ?? '').trim();
  if (!c) return '—';
  try {
    return REGION_NAMES?.of(c.toUpperCase()) ?? c;
  } catch {
    return c;
  }
}

function fmtDateTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v.slice(0, 19).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// portone/stripe 는 PG 교체(2026-08) 이전 주문의 레거시 값 — 과거 주문 표기를 위해 남겨 둔다.
const PAY_LABEL: Record<string, string> = {
  payverse: 'PayVerse',
  transfer: tr('계좌이체/송금'),
  portone: tr('PortOne(구)'),
};
const REGION_LABEL: Record<string, string> = { domestic: tr('국내'), overseas: tr('해외') };
const SHIP_STATUS_LABEL: Record<string, string> = {
  preparing: tr('준비중'),
  shipped: tr('발송'),
  delivered: tr('배송완료'),
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5">
      <span className="w-24 shrink-0 label-caps text-grey-400">{label}</span>
      <span className="min-w-0 flex-1 break-words text-sm text-grey-700">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-grey-200 p-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey-500">{title}</h3>
      {children}
    </section>
  );
}

export function OrderDetail({ orderId }: { orderId?: string }) {
  const { locale } = useLocale();
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', 'detail-full', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const supabase = createClient();
      // 선택 컬럼을 하나씩 떼며 재조회 — 마이그레이션 미적용이어도 상세는 열린다.
      let res = await supabase.from('orders').select(SELECT_STEPS[0]).eq('id', orderId!).single();
      for (let i = 1; res.error && i < SELECT_STEPS.length; i++) {
        res = await supabase.from('orders').select(SELECT_STEPS[i]).eq('id', orderId!).single();
      }
      if (res.error) throw res.error;
      return res.data as unknown as OrderDetailData;
    },
  });

  if (!orderId) return null;
  if (isLoading) return <p className="text-sm text-grey-500">{tr('불러오는 중…')}</p>;
  if (error || !data) return <p className="text-sm text-danger">{tr('상세 정보를 불러오지 못했습니다.')}</p>;

  const b = data.buyer;
  const items = data.order_items ?? [];
  const shipments = data.shipments ?? [];
  // 표시 통화(서브통화) 병기 — display_* 가 있으면 고객이 결제한 통화(바트 등)로. 라인은 총액 비율로 안분(근사).
  const hasDisplay = !!data.display_currency && data.display_total != null;
  const fmtItem = (minor: number, itemCurrency: string) =>
    hasDisplay && data.total_amount > 0
      ? formatAmount(Math.round((minor * data.display_total!) / data.total_amount), data.display_currency!)
      : formatAmount(minor, itemCurrency);
  const productName = (p: OrderItem['product']) =>
    (p ? pickI18n(p.name_i18n, locale) || pickI18n(p.name_i18n, 'en') || p.code : '') || '—';
  const sellerName = (s: OrderItem['seller']) =>
    (s ? s.partners?.[0]?.company_name || s.name || s.email : '') || '—';
  // 구매한 패스(풀 패스/파티 패스 등). 주문에 저장돼 있으면 그대로, 0042 이전 주문이면 단가로 역추적한다.
  const passOf = (it: OrderItem) =>
    resolveOrderPass(it.product?.event_content?.tickets, {
      ticketKey: it.ticket_key,
      ticketName: it.ticket_name_i18n,
      unitPrice: it.unit_price,
      currency: it.currency as Currency,
    });

  return (
    <div className="space-y-3">
      <Section title={tr('주문 정보')}>
        <Row label={tr('주문번호')}>{data.order_no}</Row>
        <Row label={tr('주문일시')}>{fmtDateTime(data.created_at)}</Row>
        <Row label={tr('최종수정')}>{fmtDateTime(data.updated_at)}</Row>
        <Row label={tr('결제수단')}>{data.payment_method ? PAY_LABEL[data.payment_method] ?? data.payment_method : '—'}</Row>
        <Row label={tr('결제금액')}>
          {hasDisplay ? (
            <>
              <span className="font-medium text-grey-900">
                {formatAmount(data.display_total!, data.display_currency!)}
              </span>
              <span className="ml-2 text-xs text-grey-400">
                (정산 {formatAmount(data.total_amount, data.currency)})
              </span>
            </>
          ) : (
            formatAmount(data.total_amount, data.currency)
          )}
        </Row>
      </Section>

      <Section title={tr('회원(주문자)')}>
        <Row label={tr('이름')}>{b?.name || '—'}</Row>
        <Row label={tr('이메일')}>{b?.email || '—'}</Row>
        <Row label={tr('연락처')}>{b?.phone || '—'}</Row>
        <Row label={tr('국가')}>{countryLabel(b?.country ?? null)}</Row>
      </Section>

      <Section title={`${tr('주문 상품')} (${items.length})`}>
        {items.length === 0 ? (
          <p className="py-1.5 text-sm text-grey-500">{tr('상품 내역이 없습니다.')}</p>
        ) : (
          <ul className="divide-y divide-grey-100">
            {items.map((it, i) => {
              const pass = passOf(it);
              return (
                <li key={i} className="py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-grey-800">{productName(it.product)}</p>
                      {pass && (
                        <p className="mt-0.5 text-sm font-medium text-primary">
                          {pickI18n(pass.name, locale) || pickI18n(pass.name, 'en')}
                          {pass.tierLabel && <span className="text-grey-500"> · {pass.tierLabel}</span>}
                          {!pass.exact && <span className="ml-1 text-xs text-grey-400">({tr('추정')})</span>}
                        </p>
                      )}
                      <p className="text-xs text-grey-500">
                        {tr('오거나이저')}: {sellerName(it.seller)} · {fmtItem(it.unit_price, it.currency)} × {it.qty}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-grey-800">
                      {fmtItem(it.line_amount, it.currency)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {shipments.length > 0 && (
        <Section title={tr('배송')}>
          {shipments.map((s, i) => (
            <div key={i} className={i > 0 ? 'mt-2 border-t border-grey-100 pt-2' : ''}>
              <Row label={tr('구분')}>{REGION_LABEL[s.region] ?? s.region}</Row>
              <Row label={tr('상태')}>{SHIP_STATUS_LABEL[s.status] ?? s.status}</Row>
              <Row label={tr('택배사')}>{s.carrier || '—'}</Row>
              <Row label={tr('송장번호')}>{s.tracking_no || '—'}</Row>
              <Row label={tr('발송일')}>{s.shipped_at || '—'}</Row>
              <Row label={tr('도착예정')}>{s.eta || '—'}</Row>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
