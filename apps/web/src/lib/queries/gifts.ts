// 선물하기 — 조회 쿼리. RLS: gifts 는 보낸이/받는이만 SELECT.
// 선물 가능 패스(내가 구매한 티켓 중 가용수량>0), 보낸 이력, 받은 선물(+QR 표시용 order_id).
import { createClient } from '@/lib/supabase/server';
import type { EventContent, I18n } from '@123band/shared';

interface GiftProduct {
  id: string;
  name_i18n: I18n;
  image_url: string | null;
  event_content: EventContent | null;
}

export interface GiftableItem {
  orderItemId: string;
  orderId: string;
  orderNo: string;
  /** 선물 가능 수량 = qty - 입장완료 - 이미 선물함 */
  available: number;
  qty: number;
  product: GiftProduct | null;
}

export interface SentGift {
  id: string;
  qty: number;
  message: string | null;
  createdAt: string;
  recipientName: string | null;
  recipientEmail: string | null;
  nameI18n: I18n;
  product: GiftProduct | null;
}

/** 선물받은 패스 1장 — 입장 QR 은 이 시크릿을 담는다(order_id 아님). */
export interface ReceivedPass {
  secret: string;
  used: boolean;
}

/** 선물받은 이력 — 선물함 '받은' 탭에 남긴다. 받기(claim) 전엔 QR 없음, 받으면 주문내역에 표시. */
export interface ReceivedGift {
  id: string;
  qty: number;
  message: string | null;
  createdAt: string;
  senderName: string | null;
  orderId: string;
  orderNo: string | null;
  nameI18n: I18n;
  product: GiftProduct | null;
  /** 받기(내 주문으로 이동) 완료 여부. false 면 아직 이동 전(QR 없음). */
  claimed: boolean;
}

/** 받아서 내 소유가 된 패스 묶음 — 주문내역의 '선물받은 패스' 카드에 쓴다. */
export interface ReceivedPassCard {
  giftId: string;
  orderNo: string | null;
  nameI18n: I18n;
  senderName: string | null;
  product: GiftProduct | null;
  passes: ReceivedPass[];
}

const PRODUCT_SELECT = 'id, name_i18n, image_url, product_type, event_content';

/** 내가 선물할 수 있는 패스 — 내가 현재 소유한(owner_id=본인) valid 패스를 order_item 별로 집계. */
export async function getGiftableItems(): Promise<GiftableItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // RLS(passes_owner_read)로 내 소유 패스만. valid 상태(선물/입장 안 된 것)만 대상.
  const { data: passes } = await supabase
    .from('passes')
    .select(`order_item_id, order_id, orders(order_no, status), products(${PRODUCT_SELECT})`)
    .eq('owner_id', user.id)
    .eq('status', 'valid');

  type Row = {
    order_item_id: string;
    order_id: string;
    orders: { order_no: string; status: string } | null;
    products: (GiftProduct & { product_type: string }) | null;
  };

  // order_item 별 집계 — 가용수량 = 내 valid 패스 개수.
  const byItem = new Map<string, GiftableItem>();
  for (const p of (passes ?? []) as unknown as Row[]) {
    const st = p.orders?.status;
    if (st === 'cancelled' || st === 'refunded') continue;
    if (p.products?.product_type !== 'ticket') continue;
    const existing = byItem.get(p.order_item_id);
    if (existing) {
      existing.available += 1;
      existing.qty += 1;
      continue;
    }
    byItem.set(p.order_item_id, {
      orderItemId: p.order_item_id,
      orderId: p.order_id,
      orderNo: p.orders?.order_no ?? '',
      available: 1,
      qty: 1,
      product: p.products
        ? {
            id: p.products.id,
            name_i18n: p.products.name_i18n,
            image_url: p.products.image_url,
            event_content: p.products.event_content,
          }
        : null,
    });
  }
  return [...byItem.values()];
}

/** 내가 보낸 선물 이력 (최신순) */
export async function getSentGifts(): Promise<SentGift[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('gifts')
    .select(
      `id, qty, message, created_at, recipient_name, recipient_email, name_i18n, products(${PRODUCT_SELECT})`,
    )
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false });
  return (
    (data ?? []) as unknown as {
      id: string;
      qty: number;
      message: string | null;
      created_at: string;
      recipient_name: string | null;
      recipient_email: string | null;
      name_i18n: I18n;
      products: GiftProduct | null;
    }[]
  ).map((g) => ({
    id: g.id,
    qty: g.qty,
    message: g.message,
    createdAt: g.created_at,
    recipientName: g.recipient_name,
    recipientEmail: g.recipient_email,
    nameI18n: g.name_i18n,
    product: g.products ?? null,
  }));
}

/** 내가 받은 선물 이력 (최신순) — 받기 전/후 모두. QR 은 받은 뒤 주문내역에서. */
export async function getReceivedGifts(): Promise<ReceivedGift[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('gifts')
    .select(
      `id, qty, message, created_at, sender_name, order_id, order_no, status, name_i18n, products(${PRODUCT_SELECT})`,
    )
    .eq('recipient_id', user.id)
    .in('status', ['sent', 'claimed'])
    .order('created_at', { ascending: false });

  return (
    (data ?? []) as unknown as {
      id: string;
      qty: number;
      message: string | null;
      created_at: string;
      sender_name: string | null;
      order_id: string;
      order_no: string | null;
      status: string;
      name_i18n: I18n;
      products: GiftProduct | null;
    }[]
  ).map((g) => ({
    id: g.id,
    qty: g.qty,
    message: g.message,
    createdAt: g.created_at,
    senderName: g.sender_name,
    orderId: g.order_id,
    orderNo: g.order_no,
    nameI18n: g.name_i18n,
    product: g.products ?? null,
    claimed: g.status === 'claimed',
  }));
}

/** 받아서(claim) 내 소유가 된 패스 — 주문내역의 '선물받은 패스' 섹션용. gift 스냅샷 + 내 소유 패스로 구성. */
export async function getReceivedPasses(): Promise<ReceivedPassCard[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 받기 완료(claimed)한 선물 — 받은 사람 본인. RLS(gifts_select_own).
  const { data: gifts } = await supabase
    .from('gifts')
    .select(
      `id, order_item_id, order_no, sender_name, name_i18n, products(${PRODUCT_SELECT})`,
    )
    .eq('recipient_id', user.id)
    .eq('status', 'claimed')
    .order('created_at', { ascending: false });

  const rows = (gifts ?? []) as unknown as {
    id: string;
    order_item_id: string;
    order_no: string | null;
    sender_name: string | null;
    name_i18n: I18n;
    products: GiftProduct | null;
  }[];
  if (rows.length === 0) return [];

  // 내가 소유한 패스(선물로 받은 것) — order_item 별로 묶는다. RLS: owner_id=본인.
  const { data: myPasses } = await supabase
    .from('passes')
    .select('order_item_id, redemption_secret, status')
    .eq('owner_id', user.id)
    .in('status', ['valid', 'used']);
  const byItem = new Map<string, ReceivedPass[]>();
  for (const p of (myPasses ?? []) as {
    order_item_id: string;
    redemption_secret: string;
    status: string;
  }[]) {
    const list = byItem.get(p.order_item_id) ?? [];
    list.push({ secret: p.redemption_secret, used: p.status !== 'valid' });
    byItem.set(p.order_item_id, list);
  }

  return rows
    .map((g) => ({
      giftId: g.id,
      orderNo: g.order_no,
      nameI18n: g.name_i18n,
      senderName: g.sender_name,
      product: g.products ?? null,
      passes: byItem.get(g.order_item_id) ?? [],
    }))
    .filter((c) => c.passes.length > 0);
}
