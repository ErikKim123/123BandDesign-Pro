-- Design Ref: 티켓 잔여 수량 — '판매 수량(units)' 이 입력만 받고 아무 데서도 쓰이지 않던 것을 살린다.
--
-- 남은 수량을 컬럼에 저장해 두고 구매마다 빼지 않는 이유:
--   · 취소·환불·주문 삭제 때마다 되돌려야 하고, 한 번이라도 놓치면 숫자가 영영 어긋난다.
--   · 동시 구매에서 빼기 경합이 나면 초과 판매가 그대로 남는다.
--   판매량은 주문에서 '세면' 언제나 맞는다. 환불하면 저절로 줄고, 손으로 고칠 일이 없다.
--
-- 세는 기준은 결제가 끝난 주문만(paid/shipped/done).
--   pending 까지 세면 결제창만 열고 닫은 건들 때문에 멀쩡한 티켓이 매진으로 보인다
--   (실제로 이 시스템에 pending 이 51건 쌓여 있다).
--
-- SECURITY DEFINER 인 이유: 고객 상세 페이지는 로그인 없이도 남은 수량을 보여줘야 하는데,
-- 비로그인 사용자가 orders 를 읽을 수는 없다. 이 함수는 '티켓별 합계'만 돌려주고
-- 주문·구매자는 일절 드러내지 않는다.
--
-- idempotent: create or replace.

create or replace function ticket_sold_counts(p_product uuid)
returns jsonb
language sql
stable
security definer
set search_path = band123
as $$
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
  from (
    select coalesce(oi.ticket_key, '') as k, sum(oi.qty)::int as n
    from order_items oi
    join orders o on o.id = oi.order_id
    where oi.product_id = p_product
      and o.status in ('paid', 'shipped', 'done')
      and coalesce(oi.ticket_key, '') <> ''
    group by 1
  ) t;
$$;

comment on function ticket_sold_counts(uuid) is
  '상품의 티켓(ticket_key)별 판매 수량 합계. 결제완료 이후 주문만 센다. 잔여 = units - 이 값.';

-- 비로그인 고객도 상세 페이지에서 남은 수량을 봐야 한다. 합계만 나가므로 노출될 개인정보가 없다.
revoke all on function ticket_sold_counts(uuid) from public;
grant execute on function ticket_sold_counts(uuid) to anon, authenticated;

-- 판매자·운영자 화면은 상품 여러 개를 한 번에 그린다 — 상품마다 왕복하지 않도록 묶음 조회도 둔다.
create or replace function ticket_sold_counts_many(p_products uuid[])
returns jsonb
language sql
stable
security definer
set search_path = band123
as $$
  select coalesce(jsonb_object_agg(pid, cnt), '{}'::jsonb)
  from (
    select oi.product_id::text as pid,
           jsonb_object_agg(coalesce(oi.ticket_key, ''), oi.n) as cnt
    from (
      select oi.product_id, oi.ticket_key, sum(oi.qty)::int as n
      from order_items oi
      join orders o on o.id = oi.order_id
      where oi.product_id = any(p_products)
        and o.status in ('paid', 'shipped', 'done')
        and coalesce(oi.ticket_key, '') <> ''
      group by oi.product_id, oi.ticket_key
    ) oi
    group by oi.product_id
  ) x;
$$;

comment on function ticket_sold_counts_many(uuid[]) is
  '여러 상품의 티켓별 판매 수량 — {product_id: {ticket_key: 판매수}}.';

revoke all on function ticket_sold_counts_many(uuid[]) from public;
grant execute on function ticket_sold_counts_many(uuid[]) to anon, authenticated;
