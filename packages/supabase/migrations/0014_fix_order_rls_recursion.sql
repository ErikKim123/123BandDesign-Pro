-- Design Ref: §4.2 / §7 — orders ↔ order_items RLS 상호 순환(무한재귀) 수정.
-- ⚠️ Supabase SQL Editor 에서 0001~0013 적용 후 실행.
--
-- 문제: order_items_visibility 정책이 orders 를 조회(buyer 확인)하고,
--       orders_seller_read 정책(0011)이 order_items 를 조회(판매자 확인)하여
--       서로의 RLS 를 호출 → "infinite recursion detected in policy for relation order_items".
--       → 주문내역(/account/orders)·파트너 정산 조회가 모두 실패.
--
-- 해결: 교차 조회를 SECURITY DEFINER 함수로 감싼다. is_admin() 과 동일하게 정의자(소유자)
--       권한으로 실행되어 대상 테이블의 RLS 를 타지 않으므로 순환이 끊긴다.

-- 주문의 구매자가 현재 사용자인가 (orders RLS 우회 조회)
create or replace function band123.is_order_buyer(p_order_id uuid) returns boolean as $$
  select exists (
    select 1 from orders o where o.id = p_order_id and o.buyer_id = auth.uid()
  );
$$ language sql security definer stable set search_path = band123;

-- 주문에 현재 사용자(판매자)의 상품이 포함되어 있는가 (order_items RLS 우회 조회)
create or replace function band123.order_has_my_item(p_order_id uuid) returns boolean as $$
  select exists (
    select 1 from order_items oi where oi.order_id = p_order_id and oi.seller_id = auth.uid()
  );
$$ language sql security definer stable set search_path = band123;

-- ── order_items: 구매자(주문 소유)·판매자(정산)·admin — 함수로 순환 제거 ──
drop policy if exists "order_items_visibility" on order_items;
create policy "order_items_visibility" on order_items
  for select using (
    seller_id = auth.uid()
    or is_admin()
    or band123.is_order_buyer(order_id)
  );

drop policy if exists "order_items_buyer_insert" on order_items;
create policy "order_items_buyer_insert" on order_items
  for insert with check (band123.is_order_buyer(order_id));

-- ── orders: 판매자 읽기 — 함수로 순환 제거 (buyer/admin 정책은 단순하여 그대로) ──
drop policy if exists "orders_seller_read" on orders;
create policy "orders_seller_read" on orders
  for select using (band123.order_has_my_item(orders.id));

-- ── shipments: 주문 소유자 확인도 동일 함수로 (orders RLS 재진입 방지) ──
drop policy if exists "shipments_visibility" on shipments;
create policy "shipments_visibility" on shipments
  for select using (is_admin() or band123.is_order_buyer(order_id));
