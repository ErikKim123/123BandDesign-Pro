-- Design Ref: 패스(티켓) 다회 입장 — QR 스캔 1회 = 1명 입장(-1). 기존 0019 는 전량 일괄 입장이었다.
-- order_items.checked_in_count 를 두어 스캔할 때마다 +1 하고, qty 에 도달하면 소진(입장완료).
-- checked_in_at 은 '최초 입장 시각'으로 유지(호환). 완전 소진 판정 = checked_in_count >= qty.
-- idempotent: add column if not exists / drop+create function.

-- 1) 입장 누적 수량 컬럼 ------------------------------------------------
alter table order_items
  add column if not exists checked_in_count int not null default 0;

comment on column order_items.checked_in_count is '입장 처리된 수량(스캔 누적). qty 에 도달하면 소진(입장완료).';

-- 기존(0019) 전량입장 데이터 보정: 이미 입장 처리된 항목은 수량만큼 채워 소진 상태로.
update order_items
  set checked_in_count = qty
  where checked_in_at is not null and checked_in_count = 0;

-- 2) 체크인 RPC 교체 — 스캔 1회당 남은 수량이 있는 항목 하나를 +1 --------
-- 반환 컬럼이 바뀌므로 먼저 drop (return type 변경은 replace 불가).
drop function if exists checkin_order(uuid);

create or replace function checkin_order(p_order_id uuid)
returns table (
  order_no text,
  order_status text,
  my_items int,       -- 이 주문에서 내가 판매한 항목 수
  newly_checked int,  -- 이번 스캔으로 입장 처리된 수 (0 또는 1)
  remaining int,      -- 내(판매자) 항목의 남은 입장 총합 (처리 후)
  already boolean     -- 남은 수량이 없어 이번에 처리된 게 없으면 true(=이미 소진)
)
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_my_items int;
  v_order_no text;
  v_status text;
  v_target uuid;
  v_newly int := 0;
  v_remaining int;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select o.order_no, o.status into v_order_no, v_status
    from orders o where o.id = p_order_id;
  if v_order_no is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_my_items
    from order_items oi
    where oi.order_id = p_order_id and oi.seller_id = v_uid;

  -- 이 주문에 내가 판매한 상품이 하나도 없으면 권한 없음
  if v_my_items = 0 then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- 남은 수량(checked_in_count < qty)이 있는 내 항목 하나를 잠그고 +1 (동시 스캔 안전).
  select oi.id into v_target
    from order_items oi
    where oi.order_id = p_order_id
      and oi.seller_id = v_uid
      and oi.checked_in_count < oi.qty
    order by oi.id
    limit 1
    for update;

  if v_target is not null then
    update order_items
      set checked_in_count = checked_in_count + 1,
          checked_in_at = coalesce(checked_in_at, now()),
          checked_in_by = coalesce(checked_in_by, v_uid)
      where id = v_target;
    v_newly := 1;
  end if;

  select coalesce(sum(oi.qty - oi.checked_in_count), 0) into v_remaining
    from order_items oi
    where oi.order_id = p_order_id and oi.seller_id = v_uid;

  return query select v_order_no, v_status, v_my_items, v_newly, v_remaining, (v_newly = 0);
end;
$$;

revoke all on function checkin_order(uuid) from public;
grant execute on function checkin_order(uuid) to authenticated;

-- 참고: 입장 상태 조회는 기존 order_items_visibility(SELECT, seller_id=auth.uid()) 정책으로 가능하다.
