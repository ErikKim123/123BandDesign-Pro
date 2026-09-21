-- Design Ref: §4.2 / §7 — 파트너(판매자)가 자기 상품이 포함된 주문을 조회할 수 있게 RLS 보강.
-- 배경: order_items 는 seller_id=auth.uid() 로 판매자에게 노출되지만(order_items_visibility),
--       부모 orders 는 buyer_id=auth.uid() 또는 admin 만 노출(orders_buyer_own)되어
--       파트너 포털의 판매/정산 화면에서 주문번호·상태·일자를 볼 수 없었다.
-- 조치: 자기 상품(order_items.seller_id = auth.uid())이 포함된 주문에 한해 SELECT 허용.
--       (정책은 OR 로 합쳐지므로 기존 buyer/admin 접근에는 영향 없음. 읽기 전용.)
-- idempotent: drop policy if exists 후 create.

drop policy if exists "orders_seller_read" on orders;
create policy "orders_seller_read" on orders
  for select using (
    exists (
      select 1 from order_items oi
      where oi.order_id = orders.id
        and oi.seller_id = auth.uid()
    )
  );
