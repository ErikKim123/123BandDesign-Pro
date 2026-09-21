// Design Ref: §5 Phase 4 — 장바구니 상태 (로그인 전용). 사용자별로 localStorage 에 보관한다.
// - 저장 키를 사용자 id 로 분리 → 공용 브라우저에서 다른 사용자의 장바구니가 보이지 않는다.
// - 로그아웃해도 저장소는 지우지 않는다 → 재로그인하면 담아둔 항목이 그대로 복원된다.
// - 저장은 로그인 상태에서만 → 로그아웃·일시적 세션 오류가 기존 장바구니를 덮어쓰지 못한다.
// 비로그인 중에는 메모리만 비워 "로그인 전엔 빈 장바구니"를 유지한다.
'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { I18n, Prices } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';

export interface CartItem {
  id: string;
  // 같은 상품이라도 티켓(패스) 변형별로 별도 라인. 없으면 상품 자체(실물/구독 등).
  ticketKey?: string;
  ticketName?: I18n;
  name_i18n: I18n;
  prices: Prices;
  seller_id: string;
  is_partner_product: boolean;
  product_type: string;
  // 장바구니 표시용 부가정보 (선택) — 썸네일/부제(행사 일시·장소 등)
  image_url?: string | null;
  meta_i18n?: I18n;
  qty: number;
}

/** 장바구니 라인 키 — 같은 상품이라도 티켓별로 구분(상품id + 티켓키). */
export function lineKey(id: string, ticketKey?: string): string {
  return ticketKey ? `${id}::${ticketKey}` : id;
}

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  /** 메모리만 비움 (저장소는 다음 저장 때 반영). */
  clear: () => void;
  /** 결제 완료·탈퇴처럼 이 사용자의 장바구니를 확실히 없앨 때. 저장소까지 즉시 비운다. */
  purge: () => void;
  count: number;
  // 로그인 여부: null=확인중, true=로그인, false=비로그인(장바구니 사용 불가)
  authed: boolean | null;
}

const CART_STORAGE_PREFIX = 'band-cart';
// 사용자별 분리 이전의 전역 단일 키 — 최초 복원 시 현재 사용자 키로 이관하고 제거한다.
const LEGACY_STORAGE_KEY = CART_STORAGE_PREFIX;

/** 사용자별 장바구니 저장 키. */
export function cartStorageKey(userId: string): string {
  return `${CART_STORAGE_PREFIX}:${userId}`;
}

const CartCtx = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  // 복원을 마친 사용자. 복원 전에 빈 배열로 저장소를 덮어쓰는 것을 막는다.
  const loadedFor = useRef<string | null>(null);
  // 사용자 확정 전에 purge() 가 불린 경우(결제완료 페이지가 마운트 즉시 호출) 예약해 둔다.
  // 확정 시 복원 대신 삭제 → 방금 결제한 항목이 저장소에서 되살아나지 않는다.
  const pendingPurge = useRef(false);

  // 로그인 상태 추적 — 초기 확인 + 로그인/로그아웃 변화 구독
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserId(data.user?.id ?? null);
      setAuthed(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthed(!!session?.user);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 사용자가 확정되면 그 사용자의 장바구니를 복원.
  // 비로그인이면 메모리만 비운다 — 저장소는 건드리지 않아 재로그인 시 그대로 돌아온다.
  useEffect(() => {
    if (authed === null) return; // 확인중
    if (!userId) {
      loadedFor.current = null;
      setItems([]);
      return;
    }
    if (loadedFor.current === userId) return;
    // 사용자 확정 전에 예약된 삭제가 있으면 복원하지 않고 비운다.
    if (pendingPurge.current) {
      pendingPurge.current = false;
      try {
        localStorage.removeItem(cartStorageKey(userId));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* 접근 불가 무시 */
      }
      loadedFor.current = userId;
      setItems([]);
      return;
    }
    let restored: CartItem[] = [];
    try {
      const key = cartStorageKey(userId);
      let raw = localStorage.getItem(key);
      // 전역 단일 키 시절의 장바구니는 현재 로그인 사용자 것으로 보고 1회 이관.
      if (raw === null) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy !== null) {
          raw = legacy;
          localStorage.setItem(key, legacy);
        }
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      if (raw) restored = JSON.parse(raw) as CartItem[];
    } catch {
      /* 손상된 값 무시 */
    }
    loadedFor.current = userId;
    setItems(Array.isArray(restored) ? restored : []);
  }, [authed, userId]);

  // 이미지 백필 — 예전에(이미지 필드 도입 전) 담긴 항목은 image_url 이 비어 있다.
  // 공개읽기(status='active') 로 products.image_url 을 한 번만 조회해 채운다.
  const backfilled = useRef(false);
  useEffect(() => {
    // 복원을 마친 뒤에만 — 복원 전 빈 목록으로 "채울 게 없다"고 단정하지 않도록.
    if (!userId || loadedFor.current !== userId || backfilled.current) return;
    const missing = items.filter((i) => !i.image_url).map((i) => i.id);
    if (missing.length === 0) {
      backfilled.current = true;
      return;
    }
    backfilled.current = true;
    createClient()
      .from('products')
      .select('id, image_url')
      .in('id', missing)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const map = new Map(data.map((d) => [d.id as string, d.image_url as string | null]));
        setItems((prev) =>
          prev.map((i) => (map.has(i.id) ? { ...i, image_url: map.get(i.id) ?? null } : i)),
        );
      });
  }, [userId, items]);

  // 변경 시 저장 — 복원을 마친 로그인 사용자에 한해.
  // 비로그인 상태에선 저장소를 건드리지 않는다(로그아웃/세션 오류로 장바구니가 날아가지 않게).
  useEffect(() => {
    if (!userId || loadedFor.current !== userId) return;
    try {
      localStorage.setItem(cartStorageKey(userId), JSON.stringify(items));
    } catch {
      /* 용량 초과 등 무시 */
    }
  }, [items, userId]);

  function add(item: Omit<CartItem, 'qty'>, qty = 1) {
    setItems((prev) => {
      const k = lineKey(item.id, item.ticketKey);
      const found = prev.find((i) => lineKey(i.id, i.ticketKey) === k);
      if (found) {
        return prev.map((i) => (lineKey(i.id, i.ticketKey) === k ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { ...item, qty }];
    });
  }
  function remove(key: string) {
    setItems((prev) => prev.filter((i) => lineKey(i.id, i.ticketKey) !== key));
  }
  function setQty(key: string, qty: number) {
    setItems((prev) =>
      prev.map((i) => (lineKey(i.id, i.ticketKey) === key ? { ...i, qty: Math.max(1, qty) } : i)),
    );
  }
  function clear() {
    setItems([]);
  }
  // 저장소를 즉시 지운다 — 하드 내비게이션이 저장 effect 보다 먼저 일어나도 잔여 항목이 남지 않도록.
  // (effect 가 먼저 돌면 빈 배열이 저장되고, 내비가 먼저 일어나면 키가 없다 → 어느 쪽이든 빈 장바구니)
  function purge() {
    if (userId) {
      pendingPurge.current = false;
      try {
        localStorage.removeItem(cartStorageKey(userId));
      } catch {
        /* 접근 불가 무시 */
      }
    } else {
      // 아직 사용자 미확정 — 지울 키를 모른다. 확정되는 즉시 삭제하도록 예약(위 복원 effect).
      pendingPurge.current = true;
    }
    setItems([]);
  }

  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartCtx.Provider value={{ items, add, remove, setQty, clear, purge, count, authed }}>
      {children}
    </CartCtx.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart 는 CartProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
