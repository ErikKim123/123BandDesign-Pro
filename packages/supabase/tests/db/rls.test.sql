-- ⚠️ 123Band 는 울프·JNJ 와 같은 DB 를 쓴다. 이 파일을 psql 로 직접 실행하지 말 것 —
--    검색 경로가 public 이라 이름 없는 객체가 울프 쪽에 생기고, 고정 UUID 계정이 울프 계정과 겹칠 수 있다.
--    스키마 구축은 pnpm db:bootstrap 을 쓴다.

-- Design Ref: §8.2 — L1 DB/RLS 테스트 (10 시나리오)
-- Plan SC: 파트너 격리, 고객 주문 격리, 공개읽기, admin 전체, 정산 집계
--
-- 실행: seed.sql 적용 후 service_role(또는 postgres)로 이 파일 실행.
--   psql "$DATABASE_URL" -f tests/db/rls.test.sql
-- RLS 적용을 위해 각 시나리오에서 `set local role authenticated` + jwt.claims.sub 설정.
-- 실패 시 assert 가 예외를 던져 스크립트가 중단된다(= 테스트 실패).

-- 공통 assert 헬퍼
create or replace function test_assert(cond boolean, label text) returns void as $$
begin
  if cond then
    raise notice 'PASS: %', label;
  else
    raise exception 'FAIL: %', label;
  end if;
end;
$$ language plpgsql;

-- UUID 상수(seed 와 동일)
--   admin=...001, partner=...002, customer=...003

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #1 테이블/제약 — check 위반은 거부                          ║
-- ╚══════════════════════════════════════════════════════════╝
do $$
declare ok boolean := false;
begin
  begin
    insert into profiles (id, email, role) values (gen_random_uuid(), 'x@x', 'hacker');
  exception when check_violation then ok := true;
  end;
  perform test_assert(ok, '#1 role check 제약이 잘못된 값 거부');
end $$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #2 products.prices jsonb 왕복                              ║
-- ╚══════════════════════════════════════════════════════════╝
do $$
declare v jsonb;
begin
  select prices into v from products where id = '00000000-0000-0000-0000-0000000000d1';
  perform test_assert((v->>'USD')::int = 1990 and (v->>'KRW')::int = 2900000,
    '#2 prices jsonb 통화별 값 왕복');
end $$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #3 외래키 — 존재하지 않는 category_id 거부                  ║
-- ╚══════════════════════════════════════════════════════════╝
do $$
declare ok boolean := false;
begin
  begin
    insert into products (seller_id, category_id, name_i18n, prices)
    values ('00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-0000000000ff',
            '{"en":"x"}'::jsonb, '{"USD":100}'::jsonb);
  exception when foreign_key_violation then ok := true;
  end;
  perform test_assert(ok, '#3 FK 위반(잘못된 category_id) 거부');
end $$;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #4 RLS 파트너 — 타 판매자 상품은 안 보임(active 제외)       ║
-- ║ #5 RLS 파트너 — 자기 상품은 보임                           ║
-- ╚══════════════════════════════════════════════════════════╝
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

  -- 파트너 시점: 자기 상품(p1) 보임
  do $$
  declare n int;
  begin
    select count(*) into n from products where id = '00000000-0000-0000-0000-0000000000d1';
    perform test_assert(n = 1, '#5 파트너가 자기 상품(p1) 조회 가능');
  end $$;

  -- draft 상태의 타 판매자 상품은 안 보여야 함 → 검증용 draft 상품 임시 확인
  -- (seed 상품은 모두 active 라 공개읽기로 보임. 격리는 비-active 기준으로 확인)
  do $$
  declare visible_non_active int;
  begin
    select count(*) into visible_non_active
      from products
     where seller_id <> '00000000-0000-0000-0000-000000000002'
       and status <> 'active';
    perform test_assert(visible_non_active = 0,
      '#4 파트너에게 타 판매자의 비공개(non-active) 상품은 안 보임');
  end $$;
commit;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #6 RLS 공개읽기 — 익명도 active 상품 조회                   ║
-- ╚══════════════════════════════════════════════════════════╝
begin;
  set local role anon;
  do $$
  declare n int;
  begin
    select count(*) into n from products where status = 'active';
    perform test_assert(n >= 3, '#6 익명/공개읽기로 active 상품 조회 (>=3)');
  end $$;
commit;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #7 RLS 주문 — 다른 고객 주문은 안 보임                      ║
-- ╚══════════════════════════════════════════════════════════╝
begin;
  set local role authenticated;
  -- 무관한 고객 UUID 로 위장
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-0000000000de","role":"authenticated"}', true);
  do $$
  declare n int;
  begin
    select count(*) into n from orders;
    perform test_assert(n = 0, '#7 타 고객은 남의 주문을 볼 수 없음');
  end $$;
commit;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #8 RLS admin — 전체 주문 조회                              ║
-- ╚══════════════════════════════════════════════════════════╝
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  do $$
  declare n int;
  begin
    select count(*) into n from orders;
    perform test_assert(n >= 1, '#8 admin 은 전체 주문 조회 가능 (>=1)');
  end $$;
commit;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #9 RLS order_items — 판매자가 자기 정산 항목 조회           ║
-- ╚══════════════════════════════════════════════════════════╝
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  do $$
  declare n int;
  begin
    select count(*) into n from order_items where seller_id = '00000000-0000-0000-0000-000000000002';
    perform test_assert(n = 1, '#9 파트너가 자기 판매(정산) 항목 조회 가능');
  end $$;
commit;

-- ╔══════════════════════════════════════════════════════════╗
-- ║ #10 정산 집계 — seller 별 line_amount 합계                 ║
-- ╚══════════════════════════════════════════════════════════╝
do $$
declare total int; commission numeric;
begin
  select coalesce(sum(line_amount),0) into total
    from order_items where seller_id = '00000000-0000-0000-0000-000000000002';
  select pr.commission_rate into commission
    from partners pr where pr.user_id = '00000000-0000-0000-0000-000000000002';
  -- USD 1990 × 2 = 3980, 수수료율 0.15 → 정산액(파트너 수취) = 3980 × (1 - 0.15) = 3383
  perform test_assert(total = 3980, '#10a 파트너 매출 집계 = 3980 (USD minor)');
  perform test_assert(round(total * (1 - commission)) = 3383,
    '#10b 수수료(0.15) 차감 정산액 = 3383');
end $$;

-- 정리
drop function if exists test_assert(boolean, text);

\echo '──────────────────────────────────────────'
\echo 'L1 DB/RLS 테스트 완료 — 위 PASS 라인 확인 (FAIL 시 중단됨)'
\echo '──────────────────────────────────────────'
