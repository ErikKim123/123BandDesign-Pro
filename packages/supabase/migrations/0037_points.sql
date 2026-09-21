-- 0037: 포인트(적립금) 시스템 — 원장(point_ledger) + 잔액 캐시(profiles.point_balance).
-- 배경: 신규 가입 축하 포인트를 주고, 모인 포인트를 쿠폰으로 교환(0038)하게 한다.
-- 보안 원칙(0024 선물하기와 동일 철학): 원장에 직접 insert/update 를 열지 않고
--   SECURITY DEFINER 함수(points_apply)로만 증감한다. 잔액은 원장의 파생값이므로
--   profiles.point_balance 를 사용자가 직접 UPDATE 하지 못하도록 가드 트리거로 막는다.
--   (profiles RLS 는 '본인 전체 컬럼 수정' 이라 컬럼 단위 제한이 불가능 → 트리거로 방어)
-- 정책값(가입 보너스/구매 적립률)은 app_settings('points.policy') 에 둔다 → 어드민에서 변경.
-- idempotent.

-- 1) 잔액 캐시 컬럼 --------------------------------------------------------
alter table band123.profiles
  add column if not exists point_balance int not null default 0;

-- 2) 원장(append-only) -----------------------------------------------------
create table if not exists point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  delta int not null check (delta <> 0),          -- 양수=적립, 음수=차감
  balance_after int not null check (balance_after >= 0),
  reason text not null check (reason in (
    'signup',          -- 신규 가입 축하
    'admin_grant',     -- 관리자 수동 지급
    'admin_deduct',    -- 관리자 수동 차감
    'order_earn',      -- 구매 적립
    'order_cancel',    -- 주문 취소에 따른 적립 회수
    'coupon_exchange', -- 쿠폰 교환 사용
    'coupon_restore',  -- 쿠폰 교환 취소 환급
    'expire'           -- 유효기간 만료 소멸
  )),
  memo text,
  ref_type text,                                  -- 'signup' | 'order' | 'coupon' | 'admin'
  ref_id uuid,
  created_by uuid references profiles(id) on delete set null, -- 관리자 수동 처리 시 처리자
  created_at timestamptz not null default now()
);

create index if not exists idx_point_ledger_user on point_ledger(user_id, created_at desc);
create index if not exists idx_point_ledger_reason on point_ledger(reason);
create index if not exists idx_point_ledger_ref on point_ledger(ref_type, ref_id);

alter table point_ledger enable row level security;

-- 조회: 본인 또는 관리자. (insert/update/delete 정책 없음 → 변경은 RPC 로만)
drop policy if exists point_ledger_select_own on point_ledger;
create policy point_ledger_select_own on point_ledger for select
  using (user_id = auth.uid() or is_admin());

-- 3) 잔액 직접 변경 차단 가드 ----------------------------------------------
-- points_apply 안에서만 set_config('wolf.points','on',true) 로 잠금을 열어준다(트랜잭션 로컬).
create or replace function band123.guard_point_balance()
returns trigger
language plpgsql
as $$
begin
  if new.point_balance is distinct from old.point_balance
     and coalesce(current_setting('wolf.points', true), '') <> 'on' then
    raise exception 'point_balance_readonly' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_point_balance on band123.profiles;
create trigger profiles_guard_point_balance
  before update on band123.profiles
  for each row execute function band123.guard_point_balance();

-- 4) 코어 증감 함수 --------------------------------------------------------
-- 프로필 행을 잠가(for update) 동시 적립/차감을 직렬화한다. 잔액이 음수가 되면 거부.
create or replace function band123.points_apply(
  p_user_id uuid,
  p_delta int,
  p_reason text,
  p_memo text default null,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_created_by uuid default null
)
returns point_ledger
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_balance int;
  v_row point_ledger;
begin
  if p_user_id is null then raise exception 'user_required' using errcode = '22023'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'invalid_delta' using errcode = '22023'; end if;

  select coalesce(point_balance, 0) into v_balance from profiles where id = p_user_id for update;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;

  v_balance := v_balance + p_delta;
  if v_balance < 0 then raise exception 'insufficient_points' using errcode = '22023'; end if;

  perform set_config('wolf.points', 'on', true);
  update profiles set point_balance = v_balance, updated_at = now() where id = p_user_id;
  perform set_config('wolf.points', 'off', true);

  insert into point_ledger(user_id, delta, balance_after, reason, memo, ref_type, ref_id, created_by)
  values (
    p_user_id, p_delta, v_balance, p_reason,
    nullif(btrim(coalesce(p_memo, '')), ''), p_ref_type, p_ref_id, p_created_by
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- 내부 전용 — 일반 사용자가 직접 호출할 수 없다(가입 트리거/RPC/서버가 경유).
revoke all on function band123.points_apply(uuid, int, text, text, text, uuid, uuid) from public;
grant execute on function band123.points_apply(uuid, int, text, text, text, uuid, uuid) to service_role;

-- 5) 관리자 수동 지급/차감 --------------------------------------------------
create or replace function band123.admin_adjust_points(
  p_user_id uuid,
  p_delta int,
  p_memo text default null
)
returns point_ledger
language plpgsql
security definer
set search_path = band123
as $$
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return points_apply(
    p_user_id, p_delta,
    case when p_delta > 0 then 'admin_grant' else 'admin_deduct' end,
    p_memo, 'admin', null, auth.uid()
  );
end;
$$;

revoke all on function band123.admin_adjust_points(uuid, int, text) from public;
grant execute on function band123.admin_adjust_points(uuid, int, text) to authenticated;

-- 6) 정책값(app_settings) ---------------------------------------------------
-- signup_bonus        : 신규 가입 시 지급 포인트 (0 = 미지급)
-- order_earn_percent  : 결제확정 시 결제금액 대비 적립률(%) (0 = 미적립)
-- coupon_valid_days   : 포인트로 교환한 쿠폰의 기본 유효일수(쿠폰별 valid_days 가 우선)
insert into app_settings(key, value)
values ('points.policy', jsonb_build_object('signup_bonus', 100, 'order_earn_percent', 0, 'coupon_valid_days', 30))
on conflict (key) do nothing;

-- 정책 조회 — app_settings 는 어드민 전용 RLS 라 일반 사용자는 이 함수로만 읽는다(민감정보 없음).
create or replace function band123.points_policy()
returns jsonb
language sql
stable
security definer
set search_path = band123
as $$
  select coalesce((select value from app_settings where key = 'points.policy'), '{}'::jsonb);
$$;

grant execute on function band123.points_policy() to anon, authenticated, service_role;

-- 7) 가입 트리거에 축하 포인트 추가 ------------------------------------------
-- 0017 판(country 포함)을 기반으로 재정의 + 일반회원(customer)에게만 signup_bonus 지급.
create or replace function band123.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := case when meta->>'account_type' = 'partner' then 'partner' else 'customer' end;
  v_bonus int;
begin
  insert into band123.profiles (id, email, name, phone, role, country)
  values (
    new.id,
    new.email,
    nullif(meta->>'name', ''),
    nullif(meta->>'phone', ''),
    v_role,
    nullif(meta->>'country', '')
  )
  on conflict (id) do nothing;

  if v_role = 'partner' then
    insert into band123.partners (user_id, company_name, country, biz_no)
    values (
      new.id,
      nullif(meta->>'company_name', ''),
      nullif(meta->>'country', ''),
      nullif(meta->>'biz_no', '')
    )
    on conflict (user_id) do nothing;
  end if;

  -- 신규 가입 축하 포인트 — 일반회원만. 멱등(이미 지급된 계정은 건너뜀).
  if v_role = 'customer' then
    v_bonus := coalesce((select (value->>'signup_bonus')::int from app_settings where key = 'points.policy'), 100);
    if v_bonus > 0
       and not exists (select 1 from point_ledger l where l.user_id = new.id and l.reason = 'signup') then
      perform points_apply(new.id, v_bonus, 'signup', '신규 가입 축하 포인트', 'signup', new.id, null);
    end if;
  end if;

  return new;
end;
$$;

-- 8) 구매 적립 -------------------------------------------------------------
-- 결제확정(pending→paid) 직후 서버가 호출. 멱등: 같은 주문에 대한 적립이 있으면 아무것도 하지 않는다.
-- 적립 기준액은 통화별 표시단위로 정규화한다(KRW=원, 그 외=최소단위/100 → 달러).
create or replace function band123.earn_points_for_order(p_order_id uuid)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_order orders;
  v_pct numeric;
  v_base numeric;
  v_amount int;
begin
  select * into v_order from orders where id = p_order_id;
  if not found or v_order.buyer_id is null then return 0; end if;
  if v_order.status not in ('paid', 'shipped', 'done') then return 0; end if;

  if exists (select 1 from point_ledger where ref_type = 'order' and ref_id = p_order_id and reason = 'order_earn') then
    return 0; -- 이미 적립됨
  end if;

  v_pct := coalesce((select (value->>'order_earn_percent')::numeric from app_settings where key = 'points.policy'), 0);
  if v_pct <= 0 then return 0; end if;

  v_base := case when v_order.currency = 'KRW' then v_order.total_amount else v_order.total_amount / 100.0 end;
  v_amount := floor(v_base * v_pct / 100.0)::int;
  if v_amount <= 0 then return 0; end if;

  perform points_apply(
    v_order.buyer_id, v_amount, 'order_earn',
    '구매 적립 (' || coalesce(v_order.order_no, '') || ')', 'order', p_order_id, null
  );
  return v_amount;
end;
$$;

revoke all on function band123.earn_points_for_order(uuid) from public;
grant execute on function band123.earn_points_for_order(uuid) to service_role;

-- 9) 기존 일반회원 소급 지급 -------------------------------------------------
-- 시스템 도입 이전 가입자도 동일하게 가입 축하 포인트를 받도록 1회 지급(멱등).
do $$
declare
  r record;
  v_bonus int := coalesce((select (value->>'signup_bonus')::int from app_settings where key = 'points.policy'), 100);
begin
  if v_bonus <= 0 then return; end if;
  for r in
    select p.id from profiles p
    where p.role = 'customer'
      and not exists (select 1 from point_ledger l where l.user_id = p.id and l.reason = 'signup')
  loop
    perform points_apply(r.id, v_bonus, 'signup', '기존 회원 소급 지급', 'signup', r.id, null);
  end loop;
end;
$$;
