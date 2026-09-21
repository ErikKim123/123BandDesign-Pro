-- Design Ref: 고객이 '사용한(입장완료)' 주문을 본인 주문내역에서 삭제(=숨김)한다.
-- 하드 삭제는 판매자/정산 기록을 훼손하므로, orders.buyer_hidden_at 로 소프트 삭제(구매자 뷰에서만 숨김).
-- 보안: 광범위 UPDATE 정책 대신 SECURITY DEFINER 함수로 '구매자 본인'만, 숨김 컬럼만 갱신.
-- idempotent: add column if not exists / drop+create function.

-- 1) 구매자 숨김 컬럼 --------------------------------------------------
alter table orders
  add column if not exists buyer_hidden_at timestamptz;

comment on column orders.buyer_hidden_at is '구매자가 주문내역에서 숨김(소프트 삭제)한 시각. null 이면 표시.';

-- 2) 숨김 RPC — 본인(구매자) 주문만 숨긴다 -----------------------------
drop function if exists hide_order(uuid);

create or replace function hide_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer uuid;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select buyer_id into v_buyer from orders where id = p_order_id;
  if v_buyer is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_buyer <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update orders set buyer_hidden_at = now() where id = p_order_id;
end;
$$;

revoke all on function hide_order(uuid) from public;
grant execute on function hide_order(uuid) to authenticated;
