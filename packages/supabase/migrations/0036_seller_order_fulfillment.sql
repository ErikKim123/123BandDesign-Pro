-- 0036: 오거나이저(판매자)가 자기 상품이 포함된 주문을 '발송 → 완료'까지 직접 처리.
-- ⚠️ SQL Editor 에서 0035 적용 후 실행. 파트너 포털 /orders 의 처리 버튼이 이 함수를 호출한다.
--
-- 배경: 0011/0014 로 판매자에게 orders SELECT 만 열려 있어(orders_seller_read) 파트너 주문관리가
--       읽기 전용이었다. 실제 발송/완료는 오거나이저가 하는데 매번 운영자에게 요청해야 했다.
--
-- 왜 RLS UPDATE 정책이 아니라 RPC 인가:
--  1) RLS UPDATE 는 '어느 컬럼을 바꿨는지'를 제약하지 못한다. using/with check 로 status 값을 걸어도
--     같은 UPDATE 에서 total_amount·currency·buyer_id 를 함께 바꾸는 것을 막을 수 없다.
--  2) 전이 규칙(paid→shipped, shipped→done)을 옛 행/새 행 쌍으로 정확히 강제하려면 함수가 명확하다.
--     (using 은 옛 행, with check 는 새 행만 보므로 paid→done 건너뛰기를 막지 못한다.)
--
-- 권한 경계: 결제확인(→paid)·취소·환불·주문 삭제는 돈이 오간 상태를 뒤집는 조작이라 운영자 전용으로 남긴다.
--            한 주문에 여러 판매자의 항목이 섞일 수 있어(order_items.seller_id) 주문 단위 조작의
--            파급이 크기 때문이다. 발송/완료는 이행(fulfillment) 단계라 판매자에게 연다.
--
-- ⚠️ 다중 판매자 주문: orders.status 는 주문 단위라 A 가 발송 처리하면 같은 주문에 든 B 의 항목도
--    '발송'으로 보인다. 현재 데이터는 주문당 판매자 1인이 사실상 전부라 허용하되,
--    항목 단위 이행 상태가 필요해지면 order_items 에 fulfillment 컬럼을 두고 이 함수를 그쪽으로 옮긴다.

-- 판매자 이행 전이 — 본인 항목이 포함된 주문만, paid→shipped / shipped→done 만 허용.
-- security definer: orders 의 RLS(판매자에게 UPDATE 없음)를 우회해 status 한 컬럼만 갱신한다.
create or replace function band123.seller_advance_order(p_order_id uuid, p_to text)
returns text
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_cur text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- 0014 의 SECURITY DEFINER 헬퍼 재사용 (order_items RLS 재진입 없이 소유 판정)
  if not band123.order_has_my_item(p_order_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select status into v_cur from orders where id = p_order_id;
  if v_cur is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if not ((v_cur = 'paid' and p_to = 'shipped') or (v_cur = 'shipped' and p_to = 'done')) then
    raise exception 'invalid_transition: % -> %', v_cur, p_to using errcode = '22023';
  end if;

  update orders set status = p_to, updated_at = now() where id = p_order_id;
  return p_to;
end;
$$;

-- 익명 호출 차단, 로그인 사용자만 (소유 판정은 함수 내부에서 다시 한다)
revoke all on function band123.seller_advance_order(uuid, text) from public;
revoke all on function band123.seller_advance_order(uuid, text) from anon;
grant execute on function band123.seller_advance_order(uuid, text) to authenticated;
