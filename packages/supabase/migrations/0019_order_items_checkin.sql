-- Design Ref: 오거나이저 입장확인(체크인). 고객 주문내역의 QR 을 오거나이저가 스캔하면
--   해당 오거나이저(판매자)가 판매한 order_items 를 '입장완료'로 표시한다.
-- 보안: order_items 에 광범위한 UPDATE 정책을 열면 판매자가 금액(line_amount 등)까지 바꿀 수 있어
--   위험하다. 따라서 UPDATE 정책 대신 SECURITY DEFINER 함수(checkin_order)로 '체크인 컬럼만' 갱신하고,
--   함수 내부에서 호출자(auth.uid())가 그 주문의 판매자인지 검증한다.
-- idempotent: add column if not exists / create or replace function.

-- 1) 입장(체크인) 컬럼 -------------------------------------------------
alter table order_items
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references profiles(id);

comment on column order_items.checked_in_at is '입장완료 처리 시각(오거나이저 스캔). null 이면 미입장.';
comment on column order_items.checked_in_by is '입장 처리한 오거나이저(profiles.id).';

-- 2) 체크인 RPC -------------------------------------------------------
-- 호출자(auth.uid())가 판매자인 order_items 만 입장 처리한다.
-- 반환: 주문번호/상태, 내(판매자) 항목 수, 이번에 새로 처리된 수, 이미 처리 여부.
create or replace function checkin_order(p_order_id uuid)
returns table (
  order_no text,
  order_status text,
  my_items int,
  newly_checked int,
  already boolean
)
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_my_items int;
  v_newly int;
  v_order_no text;
  v_status text;
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

  update order_items oi
    set checked_in_at = now(), checked_in_by = v_uid
    where oi.order_id = p_order_id
      and oi.seller_id = v_uid
      and oi.checked_in_at is null;
  get diagnostics v_newly = row_count;

  return query select v_order_no, v_status, v_my_items, v_newly, (v_newly = 0);
end;
$$;

-- 로그인 사용자만 호출 가능(내부에서 판매자 검증). anon 은 제외.
revoke all on function checkin_order(uuid) from public;
grant execute on function checkin_order(uuid) to authenticated;

-- 참고: 입장 상태 조회는 기존 order_items_visibility(SELECT, seller_id=auth.uid()) 정책으로 가능하다.
