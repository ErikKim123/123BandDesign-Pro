-- 0062: 스탬프(도장) 시스템 — 원장(stamp_ledger) + 현재 카드 진행(profiles.stamp_count).
-- 배경: 포인트와 별개로 "도장 N개를 모으면 쿠폰" 이라는 스탬프 카드를 준다.
--   포인트는 금액처럼 쌓이고 쓰이지만, 스탬프는 '카드 한 장을 채우는 진행도'다.
--   → 카드가 차면(goal) 쿠폰을 발급하고 그만큼 도장을 소진해 다시 빈 카드로 돌아간다.
-- 구조는 0037 포인트와 같은 철학을 따른다:
--   원장에 직접 insert 를 열지 않고 SECURITY DEFINER 함수(stamps_apply)로만 증감하며,
--   진행도 캐시(profiles.stamp_count)는 가드 트리거로 직접 UPDATE 를 막는다.
-- 적립 경로 4가지 — 결제완료 / 행사 참석(체크인) / 후기 작성 / 문의 작성 + 관리자 수동 지급.
--   중복 방지는 원장의 (user_id, ref_type, ref_id) 유니크로 DB 가 보장한다.
--   ref: order=주문 1건당 · pass=패스 1장당 · review/qna=상품 1개당.
-- 소급 지급은 하지 않는다 — 이 마이그레이션 이후의 사건부터 도장이 찍힌다.
--   (과거 주문까지 소급하면 시행 첫날 다수 회원의 카드가 즉시 완성돼 쿠폰이 쏟아진다)
-- idempotent.

-- 1) 카드 진행 캐시 컬럼 -----------------------------------------------------
alter table band123.profiles
  add column if not exists stamp_count int not null default 0;

comment on column band123.profiles.stamp_count is '현재 스탬프 카드에 찍힌 도장 수. stamp_ledger 의 파생값 — 직접 수정 불가.';

-- 2) 원장(append-only) -------------------------------------------------------
create table if not exists stamp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  delta int not null check (delta <> 0),          -- 양수=적립, 음수=카드 완성 소진/차감
  balance_after int not null check (balance_after >= 0),
  reason text not null check (reason in (
    'order_paid',     -- 결제완료 주문
    'checkin',        -- 행사 참석(패스 체크인)
    'review_write',   -- 상품후기 작성
    'qna_write',      -- 상품문의(댓글) 작성
    'admin_grant',    -- 관리자 수동 지급
    'admin_deduct',   -- 관리자 수동 차감
    'coupon_reward'   -- 카드 완성 → 쿠폰 발급하며 소진
  )),
  memo text,
  ref_type text,                                  -- 'order' | 'pass' | 'review' | 'qna' | 'admin' | 'user_coupon'
  ref_id uuid,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stamp_ledger_user on stamp_ledger(user_id, created_at desc);
create index if not exists idx_stamp_ledger_reason on stamp_ledger(reason);

-- 중복 적립 차단 — 같은 근거(ref)로는 한 번만 찍힌다. 동시 요청도 DB 가 막는다.
-- 음수(소진)는 카드를 여러 번 채울 수 있어야 하므로 제외한다.
create unique index if not exists uq_stamp_ledger_earn_ref
  on stamp_ledger(user_id, ref_type, ref_id)
  where ref_id is not null and delta > 0;

alter table stamp_ledger enable row level security;

-- 조회: 본인 또는 관리자. (쓰기 정책 없음 → 변경은 RPC 로만)
drop policy if exists stamp_ledger_select_own on stamp_ledger;
create policy stamp_ledger_select_own on stamp_ledger for select
  using (user_id = auth.uid() or is_admin());

-- 3) 진행도 직접 변경 차단 가드 ----------------------------------------------
create or replace function band123.guard_stamp_count()
returns trigger
language plpgsql
as $$
begin
  if new.stamp_count is distinct from old.stamp_count
     and coalesce(current_setting('wolf.stamps', true), '') <> 'on' then
    raise exception 'stamp_count_readonly' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_stamp_count on band123.profiles;
create trigger profiles_guard_stamp_count
  before update on band123.profiles
  for each row execute function band123.guard_stamp_count();

-- 4) 코어 증감 함수 ----------------------------------------------------------
create or replace function band123.stamps_apply(
  p_user_id uuid,
  p_delta int,
  p_reason text,
  p_memo text default null,
  p_ref_type text default null,
  p_ref_id uuid default null,
  p_created_by uuid default null
)
returns stamp_ledger
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_count int;
  v_row stamp_ledger;
begin
  if p_user_id is null then raise exception 'user_required' using errcode = '22023'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'invalid_delta' using errcode = '22023'; end if;

  -- 프로필 행 잠금 — 동시 적립을 직렬화한다(카드 완성 판정이 겹치지 않게).
  select coalesce(stamp_count, 0) into v_count from profiles where id = p_user_id for update;
  if not found then raise exception 'user_not_found' using errcode = 'P0002'; end if;

  v_count := v_count + p_delta;
  if v_count < 0 then raise exception 'insufficient_stamps' using errcode = '22023'; end if;

  perform set_config('wolf.stamps', 'on', true);
  update profiles set stamp_count = v_count, updated_at = now() where id = p_user_id;
  perform set_config('wolf.stamps', 'off', true);

  insert into stamp_ledger(user_id, delta, balance_after, reason, memo, ref_type, ref_id, created_by)
  values (
    p_user_id, p_delta, v_count, p_reason,
    nullif(btrim(coalesce(p_memo, '')), ''), p_ref_type, p_ref_id, p_created_by
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function band123.stamps_apply(uuid, int, text, text, text, uuid, uuid) from public;
grant execute on function band123.stamps_apply(uuid, int, text, text, text, uuid, uuid) to service_role;

-- 5) 정책값(app_settings) ----------------------------------------------------
-- enabled           : 스탬프 적립 on/off (끄면 새 도장이 찍히지 않는다. 기존 도장은 유지)
-- goal              : 카드 한 장을 채우는 도장 수
-- reward_coupon_id  : 카드 완성 시 발급할 쿠폰(coupons.id). 비어 있으면 발급하지 않고 도장은 계속 쌓인다.
-- per_order/per_checkin/per_review/per_qna : 각 사건당 찍히는 도장 수 (0 = 그 경로 중단)
-- coupon_valid_days : 발급 쿠폰의 기본 유효일수(쿠폰별 valid_days 가 우선)
insert into app_settings(key, value)
values ('stamps.policy', jsonb_build_object(
  'enabled', true,
  'goal', 10,
  'reward_coupon_id', null,
  'per_order', 1,
  'per_checkin', 1,
  'per_review', 1,
  'per_qna', 1,
  'coupon_valid_days', 30
))
on conflict (key) do nothing;

-- 정책 조회 — app_settings 는 어드민 전용 RLS 라 고객 화면은 이 함수로만 읽는다(민감정보 없음).
create or replace function band123.stamps_policy()
returns jsonb
language sql
stable
security definer
set search_path = band123
as $$
  select coalesce((select value from app_settings where key = 'stamps.policy'), '{}'::jsonb);
$$;

grant execute on function band123.stamps_policy() to anon, authenticated, service_role;

-- 6) 보상 쿠폰 발급 경로 확장 ------------------------------------------------
-- user_coupons.source 는 0038 에서 인라인 check 로 만들어져 이름이 자동 생성된다.
-- 이름을 가정하지 않고 source 를 참조하는 check 를 모두 지운 뒤 새로 만든다.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'band123'
      and rel.relname = 'user_coupons'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%source%'
  loop
    execute format('alter table band123.user_coupons drop constraint %I', r.conname);
  end loop;
end;
$$;
alter table user_coupons add constraint user_coupons_source_check
  check (source in ('point_exchange', 'admin_grant', 'stamp_reward'));

-- 7) 카드 완성 → 쿠폰 발급 ---------------------------------------------------
-- 도장이 goal 이상이면 쿠폰을 발급하고 goal 만큼 소진한다. 남은 도장은 다음 카드로 이월된다.
-- 쿠폰이 지정돼 있지 않거나 발급 불가(비활성/기간종료/한도소진)면 아무것도 하지 않는다
--   → 도장은 그대로 쌓여 있고, 나중에 쿠폰을 지정하면 그때 몰아서 발급된다.
create or replace function band123.redeem_stamp_card(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_policy jsonb := stamps_policy();
  v_goal int := coalesce((v_policy->>'goal')::int, 0);
  v_coupon_id uuid := nullif(v_policy->>'reward_coupon_id', '')::uuid;
  v_default_days int := coalesce((v_policy->>'coupon_valid_days')::int, 30);
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_c coupons;
  v_count int;
  v_issued int;
  v_expires date;
  v_code text;
  v_try int;
  v_uc user_coupons;
  v_total int := 0;
  v_guard int := 0;
begin
  if p_user_id is null or v_goal <= 0 or v_coupon_id is null then return 0; end if;

  select * into v_c from coupons where id = v_coupon_id for update;
  if not found or not v_c.is_active then return 0; end if;
  if v_c.starts_at is not null and v_c.starts_at > v_today then return 0; end if;
  if v_c.ends_at is not null and v_c.ends_at < v_today then return 0; end if;

  loop
    v_guard := v_guard + 1;
    exit when v_guard > 10; -- 폭주 방지(정책 오설정으로 무한 발급되는 것을 막는다)

    select coalesce(stamp_count, 0) into v_count from profiles where id = p_user_id;
    exit when v_count < v_goal;

    -- 총 발급 한도 (usage_limit 을 상한으로 사용)
    if v_c.usage_limit is not null then
      select count(*) into v_issued from user_coupons where coupon_id = v_c.id;
      exit when v_issued >= v_c.usage_limit;
    end if;

    v_expires := v_today + coalesce(v_c.valid_days, v_default_days);
    if v_c.ends_at is not null and v_c.ends_at < v_expires then v_expires := v_c.ends_at; end if;

    -- 개인 코드 발급 (전역 쿠폰 코드/다른 개인 코드와 충돌하지 않게 확인)
    v_try := 0;
    loop
      v_try := v_try + 1;
      v_code := 'ST' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit when not exists (select 1 from user_coupons where code = v_code)
            and not exists (select 1 from coupons where upper(code) = v_code);
      if v_try > 20 then raise exception 'code_gen_failed' using errcode = '22023'; end if;
    end loop;

    insert into user_coupons(user_id, coupon_id, code, source, point_cost, expires_at)
    values (p_user_id, v_c.id, v_code, 'stamp_reward', 0, v_expires)
    returning * into v_uc;

    perform stamps_apply(
      p_user_id, -v_goal, 'coupon_reward',
      '스탬프 카드 완성 — 쿠폰 발급 (' || v_uc.code || ')', 'user_coupon', v_uc.id
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function band123.redeem_stamp_card(uuid) from public;
grant execute on function band123.redeem_stamp_card(uuid) to service_role;

-- 8) 적립 함수 --------------------------------------------------------------
-- p_kind: 'order' | 'checkin' | 'review' | 'qna'. 반환값은 실제로 찍힌 도장 수(0 = 미지급).
create or replace function band123.award_stamps(
  p_user_id uuid,
  p_kind text,
  p_ref_id uuid
)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_policy jsonb := stamps_policy();
  v_key text;
  v_reason text;
  v_ref_type text;
  v_memo text;
  v_n int;
begin
  if p_user_id is null or p_ref_id is null then return 0; end if;
  if not coalesce((v_policy->>'enabled')::boolean, false) then return 0; end if;

  if p_kind = 'order' then
    v_key := 'per_order';   v_reason := 'order_paid';   v_ref_type := 'order';  v_memo := '결제완료';
  elsif p_kind = 'checkin' then
    v_key := 'per_checkin'; v_reason := 'checkin';      v_ref_type := 'pass';   v_memo := '행사 참석';
  elsif p_kind = 'review' then
    v_key := 'per_review';  v_reason := 'review_write'; v_ref_type := 'review'; v_memo := '후기 작성';
  elsif p_kind = 'qna' then
    v_key := 'per_qna';     v_reason := 'qna_write';    v_ref_type := 'qna';    v_memo := '문의 작성';
  else
    return 0;
  end if;

  v_n := coalesce((v_policy->>v_key)::int, 0);
  if v_n <= 0 then return 0; end if;

  -- 같은 근거로 이미 찍혔으면 재지급하지 않는다(유니크 인덱스와 이중 방어).
  if exists (
    select 1 from stamp_ledger
    where user_id = p_user_id and ref_type = v_ref_type and ref_id = p_ref_id and delta > 0
  ) then
    return 0;
  end if;

  perform stamps_apply(p_user_id, v_n, v_reason, v_memo, v_ref_type, p_ref_id, null);
  perform redeem_stamp_card(p_user_id);
  return v_n;
end;
$$;

revoke all on function band123.award_stamps(uuid, text, uuid) from public;
grant execute on function band123.award_stamps(uuid, text, uuid) to service_role;

-- 9) 관리자 수동 지급/차감 ---------------------------------------------------
create or replace function band123.admin_adjust_stamps(
  p_user_id uuid,
  p_delta int,
  p_memo text default null
)
returns stamp_ledger
language plpgsql
security definer
set search_path = band123
as $$
declare v_row stamp_ledger;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  v_row := stamps_apply(
    p_user_id, p_delta,
    case when p_delta > 0 then 'admin_grant' else 'admin_deduct' end,
    p_memo, 'admin', null, auth.uid()
  );
  -- 수동 지급으로 카드가 찼으면 그 자리에서 쿠폰까지 발급한다.
  if p_delta > 0 then perform redeem_stamp_card(p_user_id); end if;
  return v_row;
end;
$$;

revoke all on function band123.admin_adjust_stamps(uuid, int, text) from public;
grant execute on function band123.admin_adjust_stamps(uuid, int, text) to authenticated;

-- 10) 사건 훅 ----------------------------------------------------------------
-- 10-1) 결제확정 — 0040 판(쿠폰 차감 + 구매 적립 + 업적 평가)에 스탬프를 더한다.
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
        null;
      end;
    end if;

    begin
      perform earn_points_for_order(new.id);
    exception when others then
      null;
    end;

    begin
      perform evaluate_achievements_for(new.buyer_id);
    exception when others then
      null;
    end;

    begin
      perform award_stamps(new.buyer_id, 'order', new.id);
    exception when others then
      null; -- 스탬프 실패가 결제확정을 막지 않게 한다
    end;
  end if;
  return new;
end;
$$;

-- 10-2) 행사 참석 — 패스가 소각(status='used')될 때 그 패스 소유자에게 도장.
-- 패스 1장당 1개라 여러 장을 샀으면 장수만큼 찍힌다(입장한 인원만큼 도장).
create or replace function band123.on_pass_used()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  if new.status = 'used' and coalesce(old.status, '') <> 'used' then
    begin
      perform award_stamps(new.owner_id, 'checkin', new.id);
    exception when others then
      null; -- 스탬프 실패가 입장 처리를 막지 않게 한다
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists passes_award_stamps on band123.passes;
create trigger passes_award_stamps
  after update on band123.passes
  for each row execute function band123.on_pass_used();

-- 10-3) 후기/문의 작성 — 0040 판(포인트 + 업적)에 스탬프를 더한다.
create or replace function band123.on_product_review_created()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  begin
    perform award_content_points(new.author_id, 'review', new.product_id);
  exception when others then
    null;
  end;
  begin
    perform evaluate_achievements_for(new.author_id);
  exception when others then
    null;
  end;
  begin
    perform award_stamps(new.author_id, 'review', new.product_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace function band123.on_product_qna_created()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  begin
    perform award_content_points(new.author_id, 'qna', new.product_id);
  exception when others then
    null;
  end;
  begin
    perform evaluate_achievements_for(new.author_id);
  exception when others then
    null;
  end;
  begin
    perform award_stamps(new.author_id, 'qna', new.product_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- 11) 고객용 카드 정산 --------------------------------------------------------
-- redeem_stamp_card 는 service_role 전용이라 고객 화면이 직접 부를 수 없다.
-- 평소에는 적립 시점(award_stamps)에 자동으로 정산되지만, 그때 보상 쿠폰이
-- 지정돼 있지 않았다면(reward_coupon_id = null) 카드가 찬 채로 남는다.
-- → 나중에 관리자가 쿠폰을 지정해도, 그 회원이 다음 도장을 받기 전까지는
--   완성된 카드가 쿠폰으로 바뀌지 않는다. 그 공백을 스탬프 화면 진입 시 메운다.
-- 0039 의 claim_achievements 와 같은 역할(본인 것만, 반환값은 발급된 쿠폰 수).
create or replace function band123.claim_stamp_card()
returns int
language plpgsql
security definer
set search_path = band123
as $$
begin
  if auth.uid() is null then return 0; end if;
  return redeem_stamp_card(auth.uid());
end;
$$;

revoke all on function band123.claim_stamp_card() from public;
grant execute on function band123.claim_stamp_card() to authenticated;

-- 12) 탭 배지 화이트리스트에 stamps 추가 -------------------------------------
-- 0049 의 mark_tab_seen 은 허용 탭을 화이트리스트로 막아둔다(오타 키로 쓰레기가 쌓이는 것 방지).
-- 마이페이지에 스탬프 탭이 생겼으므로 목록에 넣어준다 — 나머지 동작은 0049 와 같다.
create or replace function band123.mark_tab_seen(p_tab text)
returns timestamptz
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_me is null then
    return null;
  end if;
  if p_tab is null or p_tab not in ('orders', 'gifts', 'points', 'stamps', 'badges') then
    raise exception 'invalid_tab';
  end if;

  update band123.profiles
     set tab_seen_at = coalesce(tab_seen_at, '{}'::jsonb)
                       || jsonb_build_object(p_tab, to_jsonb(v_now))
   where id = v_me;

  return v_now;
end;
$$;

grant execute on function band123.mark_tab_seen(text) to authenticated;
