// 주문관리(오거나이저) — 어드민 §5.4 주문관리의 오거나이저 버전. 읽기 전용.
// 내 상품(order_items.seller_id = auth.uid())이 포함된 주문만 보여준다.
//
// RLS: orders_seller_read(0011 → 0014 재귀수정)로 판매자에게 주문 행이 열려 있고,
//      profiles_seller_read_buyers(0025)로 구매자 이름/이메일이 보인다.
//      정책 미적용 환경에서도 목록이 깨지지 않도록 임베드 null·조회 실패를 폴백 처리한다.
// 서버 컴포넌트 전용.
import { createClient } from '@/lib/supabase/server';
import { pickI18n, resolveOrderPass, type Currency, type EventContent, type I18n } from '@123band/shared';

export interface PartnerOrderItem {
  id: string;
  productName: string;
  nameI18n: I18n | null; // 원본 i18n — 클라이언트에서 현재 언어로 표시
  /** 구매한 패스(티켓 티어) 표시용 라벨 — 행사명만으로는 풀/파티/1일권 구분이 안 돼서 필요(0042). 일반상품/레거시 주문은 null. */
  ticketLabel: string | null;
  qty: number;
  unitPrice: number; // 최소단위 정수
  lineAmount: number; // 최소단위 정수
  currency: string;
}

/** 주문 메일이 언제 누구에게 나갔는지(0089). 본문은 남기지 않는다. */
export interface OrderMailLogEntry {
  sentAt: string;
  locale: string;
  toEmail: string;
  /** null 이면 자동 발송이거나, 누가 보냈는지 모르는 복원 기록 */
  sentBy: string | null;
  /** auto=결제확정 자동, manual=사람이 재발송, backfill=Brevo 로그에서 복원 */
  source: 'auto' | 'manual' | 'backfill';
}

export interface PartnerOrderRow {
  id: string;
  orderNo: string | null;
  status: string | null;
  paymentMethod: string | null;
  createdAt: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  /** 주문 전체 금액(다른 판매자 상품 포함) — 참고용 */
  totalAmount: number | null;
  currency: string | null;
  /** 고객이 실제 결제/송금한 표시 통화(바트 등). 마이그레이션 0034 적용 시에만 채워진다. */
  displayCurrency: string | null;
  displayTotal: number | null;
  /** 구매확인 메일 발송 기록(최근 순). 0089 미적용 환경이면 빈 배열. */
  mailLog: OrderMailLogEntry[];
  /** 이 주문에 포함된 '내 상품'만 */
  items: PartnerOrderItem[];
  myAmount: number; // 내 상품 합계(최소단위)
  myCurrency: string; // 내 상품 통화(첫 항목 기준)
  myQty: number;
}

interface RawItem {
  id: string;
  order_id: string;
  qty: number;
  unit_price: number;
  line_amount: number;
  currency: string;
  ticket_key?: string | null;
  ticket_name_i18n?: I18n | null;
  products: { name_i18n: I18n; event_content?: EventContent | null } | null;
}

interface RawOrder {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  currency: string;
  display_currency?: string | null;
  display_total?: number | null;
  payment_method: string | null;
  created_at: string;
  buyer: { name: string | null; email: string | null } | null;
}

const ORDER_BASE =
  'id, order_no, status, total_amount, currency, payment_method, created_at, ' +
  'buyer:profiles!buyer_id(name, email)';
// 표시 통화 병기(0034) 포함. 컬럼이 없으면 ORDER_BASE 로 폴백한다.
const ORDER_WITH_DISPLAY = 'display_currency, display_total, ' + ORDER_BASE;

// in(...) URL 길이 한계를 피하려고 주문 id 를 나눠 조회한다.
const CHUNK = 100;

async function fetchOrders(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
): Promise<Map<string, RawOrder>> {
  const map = new Map<string, RawOrder>();
  let cols = ORDER_WITH_DISPLAY;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    let res = await supabase.from('orders').select(cols).in('id', slice);
    if (res.error && cols !== ORDER_BASE) {
      cols = ORDER_BASE; // 병기 컬럼 미적용 환경 — 이후 청크도 기본 컬럼으로
      res = await supabase.from('orders').select(cols).in('id', slice);
    }
    if (res.error) continue; // 이 청크는 항목 정보만으로 행을 구성한다
    for (const o of (res.data ?? []) as unknown as RawOrder[]) map.set(o.id, o);
  }
  return map;
}

/**
 * 주문별 메일 발송 기록. RLS 로 '내가 판매자인 주문'만 보인다(0089).
 * 0089 미적용 환경에서는 조회가 실패하므로 조용히 빈 맵을 돌려준다 — 목록은 그대로 떠야 한다.
 */
async function fetchMailLogs(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
): Promise<Map<string, OrderMailLogEntry[]>> {
  const map = new Map<string, OrderMailLogEntry[]>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('order_mail_log')
      .select('order_id, sent_at, locale, to_email, sent_by, source')
      .in('order_id', ids.slice(i, i + CHUNK))
      .eq('kind', 'order_confirmation')
      .order('sent_at', { ascending: false });
    if (error) return map; // 미적용 환경 — 기록 없음으로 취급
    for (const r of (data ?? []) as Array<{
      order_id: string;
      sent_at: string;
      locale: string;
      to_email: string;
      sent_by: string | null;
      source?: string | null;
    }>) {
      const list = map.get(r.order_id) ?? [];
      list.push({
        sentAt: r.sent_at,
        locale: r.locale,
        toEmail: r.to_email,
        sentBy: r.sent_by,
        // 0090 미적용 환경 폴백: source 가 없으면 sent_by 유무로 판정(0089 의 규칙)
        source: (r.source as 'auto' | 'manual' | 'backfill') ?? (r.sent_by ? 'manual' : 'auto'),
      });
      map.set(r.order_id, list);
    }
  }
  return map;
}

const ITEMS_BASE = 'id, order_id, qty, unit_price, line_amount, currency, products(name_i18n)';
// 구매한 패스(티켓 티어, 0042) 포함 — 마이그레이션 미적용 환경에서는 컬럼이 없어 실패하므로 아래로 폴백.
const ITEMS_WITH_TICKET =
  'id, order_id, qty, unit_price, line_amount, currency, ticket_key, ticket_name_i18n, ' +
  'products(name_i18n, event_content)';

/** 오거나이저 본인 상품이 포함된 주문 목록 (최근순) */
export async function getPartnerOrders(userId: string): Promise<PartnerOrderRow[]> {
  const supabase = createClient();
  // cols 를 변수로 두어야 두 select() 호출의 추론 타입이 동일해진다(fetchOrders 와 동일 패턴).
  // const 리터럴을 그대로 넘기면 호출마다 다른 리터럴 타입이 추론돼 재할당 시 타입 에러가 난다.
  let cols = ITEMS_WITH_TICKET;
  let { data: itemsData, error: itemsErr } = await supabase
    .from('order_items')
    .select(cols)
    .eq('seller_id', userId)
    .limit(2000);
  if (itemsErr) {
    cols = ITEMS_BASE;
    ({ data: itemsData, error: itemsErr } = await supabase
      .from('order_items')
      .select(cols)
      .eq('seller_id', userId)
      .limit(2000));
  }

  const items = (itemsData ?? []) as unknown as RawItem[];
  if (!items.length) return [];

  // 주문별로 내 항목 묶기
  const byOrder = new Map<string, RawItem[]>();
  for (const it of items) {
    const list = byOrder.get(it.order_id);
    if (list) list.push(it);
    else byOrder.set(it.order_id, [it]);
  }

  const orderIds = Array.from(byOrder.keys());
  const orders = await fetchOrders(supabase, orderIds);
  const mailLogs = await fetchMailLogs(supabase, orderIds);

  const rows: PartnerOrderRow[] = Array.from(byOrder.entries()).map(([orderId, its]) => {
    const o = orders.get(orderId) ?? null;
    return {
      id: orderId,
      orderNo: o?.order_no ?? null,
      status: o?.status ?? null,
      paymentMethod: o?.payment_method ?? null,
      createdAt: o?.created_at ?? null,
      buyerName: o?.buyer?.name?.trim() || null,
      buyerEmail: o?.buyer?.email?.trim() || null,
      totalAmount: o?.total_amount ?? null,
      currency: o?.currency ?? null,
      displayCurrency: o?.display_currency ?? null,
      displayTotal: o?.display_total ?? null,
      mailLog: mailLogs.get(orderId) ?? [],
      items: its.map((it) => {
        const pass = resolveOrderPass(it.products?.event_content?.tickets, {
          ticketKey: it.ticket_key,
          ticketName: it.ticket_name_i18n,
          unitPrice: it.unit_price,
          currency: it.currency as Currency,
        });
        const ticketLabel = pass
          ? [pickI18n(pass.name, 'ko') || pickI18n(pass.name, 'en'), pass.tierLabel]
              .filter(Boolean)
              .join(' · ')
          : null;
        return {
          id: it.id,
          productName:
            pickI18n(it.products?.name_i18n, 'ko') || pickI18n(it.products?.name_i18n, 'en') || '—',
          nameI18n: it.products?.name_i18n ?? null,
          ticketLabel,
          qty: it.qty,
          unitPrice: it.unit_price,
          lineAmount: it.line_amount,
          currency: it.currency,
        };
      }),
      myAmount: its.reduce((s, it) => s + Number(it.line_amount ?? 0), 0),
      myCurrency: its[0]?.currency ?? 'USD',
      myQty: its.reduce((s, it) => s + Number(it.qty ?? 0), 0),
    };
  });

  // 최근순 (created_at 가 없으면 주문번호 역순으로 보정)
  rows.sort(
    (a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '') ||
      (b.orderNo ?? '').localeCompare(a.orderNo ?? ''),
  );
  return rows;
}
