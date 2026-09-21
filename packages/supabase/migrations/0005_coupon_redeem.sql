-- Design Ref: QA 검증 — 쿠폰 사용처리 버그 수정
-- ⚠️ SQL Editor 에서 0001~0004 적용 후 실행.
-- 문제: 체크아웃에서 쿠폰을 적용해도 used_count 가 증가하지 않아 usage_limit 이 무력화됐고,
--       어떤 쿠폰이 얼마 할인됐는지 주문에 기록되지 않았다.

-- 1) 주문에 쿠폰 적용 내역 기록 (정산/CS/회계 추적)
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists discount_amount int not null default 0;

-- 2) 사용 횟수 원자적 증가 RPC
--    coupons 쓰기는 admin 전용(RLS)이라 고객 클라이언트가 직접 UPDATE 불가 → SECURITY DEFINER 로 우회.
--    UPDATE ... WHERE used_count < usage_limit 은 행 잠금으로 원자적이라 한도 초과를 막는다.
create or replace function redeem_coupon(p_code text)
returns boolean
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_ok boolean := false;
begin
  if p_code is null or btrim(p_code) = '' then
    return false;
  end if;

  update coupons
     set used_count = used_count + 1
   where upper(code) = upper(btrim(p_code))
     and is_active
     and (usage_limit is null or used_count < usage_limit)
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

grant execute on function redeem_coupon(text) to anon, authenticated;
