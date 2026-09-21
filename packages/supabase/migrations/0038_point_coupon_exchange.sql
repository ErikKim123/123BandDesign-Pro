-- 0038: 포인트 ↔ 쿠폰 교환 — 개인 발급 쿠폰(user_coupons) + 교환 RPC.
-- 배경: 기존 coupons 는 '전역 코드 + 공용 used_count' 구조라 개인에게 발급하는 개념이 없었다.
--   포인트 교환은 "내 것"인 쿠폰이 필요하므로 개인 발급 테이블을 새로 둔다.
--   coupons 행은 교환 상품(템플릿) 역할을 겸한다 → is_exchangeable/point_cost 로 노출.
-- 사용 흐름:
--   1) 어드민이 쿠폰을 만들고 '포인트 교환 가능' + '필요 포인트' 를 설정
--   2) 고객이 마이페이지에서 교환 → 포인트 차감(point_ledger) + 개인 코드(PTxxxxxxxx) 발급
--   3) 결제 시 그 코드를 입력/선택 → 할인 규칙은 원본 coupons 행을 따른다
--   4) 결제확정 시 redeem_coupon_code 로 개인 쿠폰을 used 처리
-- 보안: user_coupons 도 직접 insert/update 를 열지 않고 SECURITY DEFINER RPC 로만 다룬다.
-- idempotent.

-- 1) coupons 확장 -----------------------------------------------------------
alter table coupons
  add column if not exists is_exchangeable boolean not null default false, -- 포인트 교환 상품으로 노출
  add column if not exists point_cost int,                                 -- 교환에 필요한 포인트
  add column if not exists name_i18n jsonb not null default '{}'::jsonb,   -- 교환샵 표시명(고객 노출)
  add column if not exists valid_days int,                                 -- 발급 후 유효일수(null = 쿠폰 종료일 따름)
  add column if not exists per_user_limit int;                             -- 1인 교환 한도(null = 무제한)

create index if not exists idx_coupons_exchangeable on coupons (is_exchangeable) where is_exchangeable;

-- 2) 개인 발급 쿠폰 ---------------------------------------------------------
create table if not exists user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  coupon_id uuid not null references coupons(id) on delete cascade,
  code text not null unique,                     -- 개인 코드 (PT + 8자리)
  source text not null default 'point_exchange' check (source in ('point_exchange', 'admin_grant')),
  point_cost int not null default 0,             -- 교환에 사용한 포인트(스냅샷)
  status text not null default 'active' check (status in ('active', 'used', 'expired')),
  expires_at date,
  order_id uuid references orders(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_coupons_user on user_coupons(user_id, created_at desc);
create index if not exists idx_user_coupons_coupon on user_coupons(coupon_id);
create index if not exists idx_user_coupons_code on user_coupons(upper(code));

alter table user_coupons enable row level security;

-- 조회: 본인 또는 관리자. (쓰기 정책 없음 → 발급/사용은 RPC 로만)
drop policy if exists user_coupons_select_own on user_coupons;
create policy user_coupons_select_own on user_coupons for select
  using (user_id = auth.uid() or is_admin());

-- 3) 포인트 → 쿠폰 교환 RPC --------------------------------------------------
create or replace function band123.exchange_points_for_coupon(p_coupon_id uuid)
returns user_coupons
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_c coupons;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_default_days int;
  v_expires date;
  v_issued int;
  v_code text;
  v_try int := 0;
  v_row user_coupons;
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;

  -- 쿠폰 행 잠금 — 동시 교환으로 총 발급 한도를 넘지 않게 직렬화
  select * into v_c from coupons where id = p_coupon_id for update;
  if not found then raise exception 'coupon_not_found' using errcode = 'P0002'; end if;

  if not v_c.is_active or not coalesce(v_c.is_exchangeable, false) or coalesce(v_c.point_cost, 0) <= 0 then
    raise exception 'not_exchangeable' using errcode = '22023';
  end if;
  if v_c.starts_at is not null and v_c.starts_at > v_today then
    raise exception 'not_exchangeable' using errcode = '22023';
  end if;
  if v_c.ends_at is not null and v_c.ends_at < v_today then
    raise exception 'coupon_expired' using errcode = '22023';
  end if;

  -- 총 발급 한도 (usage_limit 을 교환 수량 상한으로 사용)
  if v_c.usage_limit is not null then
    select count(*) into v_issued from user_coupons where coupon_id = v_c.id;
    if v_issued >= v_c.usage_limit then raise exception 'sold_out' using errcode = '22023'; end if;
  end if;

  -- 1인 교환 한도
  if v_c.per_user_limit is not null then
    select count(*) into v_issued from user_coupons where coupon_id = v_c.id and user_id = v_uid;
    if v_issued >= v_c.per_user_limit then raise exception 'per_user_limit' using errcode = '22023'; end if;
  end if;

  -- 포인트 차감 — 잔액 부족이면 insufficient_points 로 롤백
  perform points_apply(
    v_uid, -v_c.point_cost, 'coupon_exchange',
    '쿠폰 교환 (' || v_c.code || ')', 'coupon', v_c.id, v_uid
  );

  -- 유효기간 = 발급일 + valid_days(없으면 정책 기본값), 쿠폰 종료일이 더 이르면 그쪽을 따른다
  v_default_days := coalesce((select (value->>'coupon_valid_days')::int from app_settings where key = 'points.policy'), 30);
  v_expires := v_today + coalesce(v_c.valid_days, v_default_days);
  if v_c.ends_at is not null and v_c.ends_at < v_expires then v_expires := v_c.ends_at; end if;

  -- 개인 코드 발급 (전역 쿠폰 코드와도 충돌하지 않게 확인)
  loop
    v_try := v_try + 1;
    v_code := 'PT' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from user_coupons where code = v_code)
          and not exists (select 1 from coupons where upper(code) = v_code);
    if v_try > 20 then raise exception 'code_gen_failed' using errcode = '22023'; end if;
  end loop;

  insert into user_coupons(user_id, coupon_id, code, source, point_cost, expires_at)
  values (v_uid, v_c.id, v_code, 'point_exchange', v_c.point_cost, v_expires)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function band123.exchange_points_for_coupon(uuid) from public;
grant execute on function band123.exchange_points_for_coupon(uuid) to authenticated;

-- 4) 결제확정 시 쿠폰 차감 ---------------------------------------------------
-- 개인 쿠폰(user_coupons)이면 used 처리, 아니면 전역 쿠폰(coupons.used_count) 증가.
-- 0005 의 redeem_coupon 을 대체하는 상위 함수(기존 함수는 호환을 위해 남겨둔다).
create or replace function band123.redeem_coupon_code(
  p_code text,
  p_user_id uuid default null,
  p_order_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_coupon_id uuid;
  v_ok boolean;
begin
  if v_code = '' then return false; end if;

  update user_coupons
     set status = 'used', used_at = now(), order_id = coalesce(p_order_id, order_id)
   where upper(code) = v_code
     and status = 'active'
     and (p_user_id is null or user_id = p_user_id)
  returning coupon_id into v_coupon_id;

  if v_coupon_id is not null then
    -- 통계용 — 원본 쿠폰의 사용 카운터도 함께 올린다(한도 검사는 교환 시점에 이미 수행)
    update coupons set used_count = used_count + 1 where id = v_coupon_id;
    return true;
  end if;

  update coupons
     set used_count = used_count + 1
   where upper(code) = v_code
     and is_active
     and (usage_limit is null or used_count < usage_limit)
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function band123.redeem_coupon_code(text, uuid, uuid) from public;
grant execute on function band123.redeem_coupon_code(text, uuid, uuid) to service_role;

-- 5) 결제확정 훅(트리거) -----------------------------------------------------
-- 주문이 'paid' 로 바뀌는 순간 (1) 쿠폰 사용처리 (2) 구매 적립 을 한다.
-- 트리거로 두는 이유: 결제확정 경로가 여러 개다(PortOne complete/webhook, 0원주문,
--   그리고 계좌이체 주문은 어드민이 주문관리에서 직접 'paid' 로 바꾼다).
--   호출부마다 붙이면 계좌이체 건이 누락돼 개인 쿠폰이 재사용될 수 있다.
-- 멱등: paid 로 '바뀌는' 전이에서만 1회 실행된다. 실패해도 결제확정은 막지 않는다.
create or replace function band123.on_order_paid()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  if new.status = 'paid' and coalesce(old.status, '') <> 'paid' then
    if new.coupon_code is not null then
      begin
        perform redeem_coupon_code(new.coupon_code, new.buyer_id, new.id);
      exception when others then
        null; -- 쿠폰 차감 실패가 결제확정을 막지 않게 한다
      end;
    end if;

    begin
      perform earn_points_for_order(new.id);
    exception when others then
      null; -- 적립 실패가 결제확정을 막지 않게 한다
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_on_paid on band123.orders;
create trigger orders_on_paid
  after update of status on band123.orders
  for each row execute function band123.on_order_paid();

-- 6) 만료 처리 ---------------------------------------------------------------
-- 조회 시점에도 expires_at 을 검사하지만, 목록 표시를 위해 상태를 정리한다(크론/수동 호출).
create or replace function band123.expire_user_coupons()
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare v_n int;
begin
  update user_coupons
     set status = 'expired'
   where status = 'active'
     and expires_at is not null
     and expires_at < (now() at time zone 'Asia/Seoul')::date;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function band123.expire_user_coupons() from public;
grant execute on function band123.expire_user_coupons() to authenticated, service_role;
