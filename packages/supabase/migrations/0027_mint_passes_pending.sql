-- Design Ref: 0026 후속 — 패스 발행 시점을 '결제확정(paid)'에서 '주문 생성(pending 포함, 취소/환불만 제외)'으로.
-- 배경: 0026 은 paid 주문에만 패스를 발행했는데, 결제 실연동 전이라 주문이 대부분 pending 으로 남아
--   주문내역 QR 이 전부 사라졌다(기존 구모델은 결제상태와 무관하게 QR 을 노출했다 → 회귀).
-- 조치:
--   1) mint_passes_for_order 를 'cancelled/refunded 외 전부' 발행하도록 확대하고,
--      구매자 본인/admin/서버(service)만 호출하도록 가드 후 authenticated 에도 실행 권한 부여
--      (주문 생성 시점 createPendingOrder 가 세션 클라이언트로 즉시 발행할 수 있게).
--   2) 기존 pending 주문에 대한 백필(부족분 발행).
-- idempotent: create or replace + 발행은 not exists 가드(함수 내부).

create or replace function mint_passes_for_order(p_order_id uuid)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer uuid;
  v_status text;
  v_item record;
  v_have int;
  v_need int;
  v_minted int := 0;
begin
  select buyer_id, status into v_buyer, v_status from orders where id = p_order_id;
  if v_buyer is null then return 0; end if;

  -- 권한: 서버(service_role, auth.uid() null) · 구매자 본인 · admin 만 발행 가능.
  if v_uid is not null and v_uid <> v_buyer and not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- 취소/환불 주문은 발행하지 않는다(그 외 pending/paid/shipped/done 은 발행).
  if v_status in ('cancelled', 'refunded') then return 0; end if;

  for v_item in
    select oi.id, oi.order_id, oi.product_id, oi.seller_id, oi.qty
    from order_items oi
    join products p on p.id = oi.product_id
    where oi.order_id = p_order_id and p.product_type = 'ticket'
  loop
    select count(*) into v_have from passes where order_item_id = v_item.id;
    v_need := v_item.qty - v_have;
    if v_need > 0 then
      insert into passes (order_item_id, order_id, product_id, seller_id, owner_id, original_buyer_id)
      select v_item.id, v_item.order_id, v_item.product_id, v_item.seller_id, v_buyer, v_buyer
      from generate_series(1, v_need);
      v_minted := v_minted + v_need;
    end if;
  end loop;

  return v_minted;
end;
$$;

-- 구매자 세션(주문 생성 시)·서버 모두 호출 가능. 내부 가드로 타인 주문 발행은 차단.
revoke all on function mint_passes_for_order(uuid) from public;
grant execute on function mint_passes_for_order(uuid) to authenticated, service_role;

-- 백필 — 취소/환불 외 모든 주문에 부족분 패스 발행(멱등). 마이그레이션은 postgres 로 실행(가드 통과).
do $$
declare
  o record;
begin
  for o in select id from orders where status not in ('cancelled', 'refunded') loop
    perform mint_passes_for_order(o.id);
  end loop;
end;
$$;
