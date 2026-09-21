-- 0063: 어드민 대시보드 — 포인트/스탬프 요약 집계 RPC.
-- 대시보드는 "미사용 포인트 합계" 같은 SUM 이 필요한데 PostgREST 로는 집계를 못 한다.
--   → 행을 전부 내려받아 JS 에서 더하는 대신, 여기서 집계해 한 번에 돌려준다.
-- 읽기 전용이며 관리자만 호출할 수 있다.
-- idempotent.

create or replace function band123.admin_loyalty_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = band123
as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select jsonb_build_object(
    -- 아직 쓰이지 않고 남아 있는 포인트 총량(부채성 지표).
    'point_outstanding', coalesce((select sum(point_balance) from profiles), 0),
    'point_holders',     (select count(*) from profiles where coalesce(point_balance, 0) > 0),
    -- 카드를 모으는 중인 회원 수. 카드가 차면 0 으로 돌아가므로 "진행 중"만 세어진다.
    'stamp_holders',     (select count(*) from profiles where coalesce(stamp_count, 0) > 0),
    -- 카드 완성 누적 횟수 = 소진 원장 건수.
    'stamp_cards_done',  (select count(*) from stamp_ledger where reason = 'coupon_reward'),
    -- 스탬프로 발급됐고 아직 안 쓴 쿠폰.
    'stamp_coupons_active',
      (select count(*) from user_coupons where source = 'stamp_reward' and status = 'active')
  ) into v;

  return v;
end;
$$;

revoke all on function band123.admin_loyalty_stats() from public;
grant execute on function band123.admin_loyalty_stats() to authenticated;
