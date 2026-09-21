-- 0040: 업적/뱃지 시스템 — 특정 임무를 달성하면 업적을 얻고 뱃지를 받는다.
-- 구성:
--   achievements       : 어드민이 관리하는 업적 카탈로그(이름/설명/뱃지이미지/조건/보상 포인트)
--   user_achievements  : 회원이 획득한 업적(= 보유 뱃지). 1회만 획득(unique).
--   conditions(jsonb)  : 조건 배열. 배열 안의 조건을 '모두' 만족해야 달성(AND).
--                        예) [{"type":"newsletter_subscribed"},{"type":"ticket_purchase","count":1}]
-- 평가 시점: 조건이 바뀔 만한 사건이 일어날 때마다 자동 재평가한다.
--   결제확정(orders→paid) / 뉴스레터 구독 / 후기·문의 작성.
--   추가로 회원이 뱃지 페이지를 열 때 claim_achievements() 로 한 번 더 확인한다(누락 자기치유).
-- 보안: 0037 포인트와 동일 철학 — user_achievements 는 조회 정책만 두고
--   생성은 SECURITY DEFINER 함수로만. 카탈로그(achievements)는 어드민 전용 쓰기 + 공개 읽기.
-- 첫 시범 업적 '첫 구매' 를 함께 시드한다(뱃지 이미지는 어드민에서 등록).
-- idempotent.

-- 1) 뱃지 이미지 버킷 --------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('band123-badges', 'band123-badges', true)
on conflict (id) do update set public = true;

drop policy if exists "band123_badges_public_read" on storage.objects;
create policy "band123_badges_public_read" on storage.objects
  for select using (bucket_id = 'band123-badges');

drop policy if exists "band123_badges_admin_write" on storage.objects;
create policy "band123_badges_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'band123-badges' and band123.is_admin())
  with check (bucket_id = 'band123-badges' and band123.is_admin());

-- 2) 업적 카탈로그 -----------------------------------------------------------
create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 내부 식별자 (예: first_purchase)
  name_i18n jsonb not null default '{}'::jsonb,    -- 업적 이름(고객 노출)
  description_i18n jsonb not null default '{}'::jsonb, -- 달성 조건 설명(고객 노출)
  badge_image_url text,                            -- 뱃지 이미지 공개 URL (badges 버킷)
  conditions jsonb not null default '[]'::jsonb,   -- 조건 배열(AND). 비어 있으면 절대 달성되지 않는다.
  point_reward int not null default 0,             -- 달성 시 함께 지급할 포인트 (0 = 없음)
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_achievements_active on achievements (is_active, sort_order);

alter table achievements enable row level security;

-- 고객도 '도전 중인 업적' 목록을 봐야 하므로 공개 읽기. 쓰기는 어드민만.
drop policy if exists achievements_public_read on achievements;
create policy achievements_public_read on achievements for select using (true);

drop policy if exists achievements_admin_write on achievements;
create policy achievements_admin_write on achievements
  for all using (is_admin()) with check (is_admin());

-- 3) 회원 획득 기록(보유 뱃지) ------------------------------------------------
create table if not exists user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  achievement_id uuid not null references achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_id)                 -- 업적당 1회
);

create index if not exists idx_user_achievements_user on user_achievements(user_id, earned_at desc);
create index if not exists idx_user_achievements_achievement on user_achievements(achievement_id);

alter table user_achievements enable row level security;

-- 조회: 본인 또는 관리자. (쓰기 정책 없음 → 획득은 RPC 로만)
drop policy if exists user_achievements_select_own on user_achievements;
create policy user_achievements_select_own on user_achievements for select
  using (user_id = auth.uid() or is_admin());

-- 4) 포인트 원장 사유에 'achievement' 추가 -------------------------------------
-- (0039 와 동일한 방식 — 이름을 가정하지 않고 reason 을 참조하는 check 를 찾아 교체)
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'band123'
      and rel.relname = 'point_ledger'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%reason%'
  loop
    execute format('alter table band123.point_ledger drop constraint %I', r.conname);
  end loop;
end;
$$;

alter table point_ledger add constraint point_ledger_reason_check check (reason in (
  'signup', 'admin_grant', 'admin_deduct', 'order_earn', 'order_cancel',
  'coupon_exchange', 'coupon_restore', 'expire', 'review_write', 'qna_write',
  'achievement'   -- 업적 달성 보상
));

-- 5) 조건 판정 ---------------------------------------------------------------
-- 지원 조건(type):
--   newsletter_subscribed         뉴스레터 구독 (profiles.email ↔ newsletter_subscribers.email)
--   ticket_purchase   {count}     결제완료된 패스(티켓) 구매 수량 합계 >= count
--   order_count       {count}     결제완료 주문 건수 >= count
--   review_count      {count}     작성한 상품후기 수 >= count
--   qna_count         {count}     작성한 상품문의(댓글) 수 >= count
--   point_total       {count}     현재 보유 포인트 >= count
-- 알 수 없는 조건은 '미달성'으로 본다 — 오타/오설정 때문에 뱃지가 새 나가지 않게 한다.
create or replace function band123.check_achievement_condition(p_user_id uuid, p_cond jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = band123
as $$
declare
  v_type  text := p_cond->>'type';
  v_count int  := greatest(coalesce((p_cond->>'count')::int, 1), 1);
  v_n     int;
  v_email text;
begin
  if v_type is null or v_type = '' then return false; end if;

  if v_type = 'newsletter_subscribed' then
    select lower(btrim(coalesce(email, ''))) into v_email from profiles where id = p_user_id;
    if v_email is null or v_email = '' then return false; end if;
    return exists (
      select 1 from newsletter_subscribers n where lower(btrim(coalesce(n.email, ''))) = v_email
    );

  elsif v_type = 'ticket_purchase' then
    select coalesce(sum(oi.qty), 0) into v_n
      from orders o
      join order_items oi on oi.order_id = o.id
      join products pr on pr.id = oi.product_id
     where o.buyer_id = p_user_id
       and pr.product_type = 'ticket'
       and o.status in ('paid', 'shipped', 'done');
    return v_n >= v_count;

  elsif v_type = 'order_count' then
    select count(*) into v_n from orders
     where buyer_id = p_user_id and status in ('paid', 'shipped', 'done');
    return v_n >= v_count;

  elsif v_type = 'review_count' then
    select count(*) into v_n from product_reviews where author_id = p_user_id;
    return v_n >= v_count;

  elsif v_type = 'qna_count' then
    select count(*) into v_n from product_qna where author_id = p_user_id;
    return v_n >= v_count;

  elsif v_type = 'point_total' then
    select coalesce(point_balance, 0) into v_n from profiles where id = p_user_id;
    return v_n >= v_count;
  end if;

  return false;
end;
$$;

revoke all on function band123.check_achievement_condition(uuid, jsonb) from public;
grant execute on function band123.check_achievement_condition(uuid, jsonb) to service_role;

-- 6) 평가/부여 ---------------------------------------------------------------
-- 내부 전용 — 호출자 검증 없음. 트리거(정의자 권한)와 service_role 만 부른다.
create or replace function band123.evaluate_achievements_for(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  r        record;
  v_conds  jsonb;
  v_ok     boolean;
  i        int;
  v_earned int := 0;
begin
  if p_user_id is null then return 0; end if;
  -- 오거나이저/관리자 계정은 업적 대상이 아니다(구매 회원 전용)
  if not exists (select 1 from profiles where id = p_user_id and role = 'customer') then
    return 0;
  end if;

  for r in
    select a.* from achievements a
     where a.is_active
       and not exists (
         select 1 from user_achievements ua
          where ua.user_id = p_user_id and ua.achievement_id = a.id
       )
     order by a.sort_order, a.created_at
  loop
    v_conds := coalesce(r.conditions, '[]'::jsonb);
    -- 조건이 하나도 없는 업적은 자동 달성으로 보지 않는다(설정 실수 방지)
    if jsonb_array_length(v_conds) = 0 then continue; end if;

    v_ok := true;
    for i in 0 .. jsonb_array_length(v_conds) - 1 loop
      if not check_achievement_condition(p_user_id, v_conds -> i) then
        v_ok := false;
        exit;
      end if;
    end loop;
    if not v_ok then continue; end if;

    insert into user_achievements(user_id, achievement_id)
    values (p_user_id, r.id)
    on conflict (user_id, achievement_id) do nothing;

    if found then
      v_earned := v_earned + 1;
      if coalesce(r.point_reward, 0) > 0 then
        begin
          perform points_apply(
            p_user_id, r.point_reward, 'achievement',
            '업적 달성 보상 (' || coalesce(r.name_i18n->>'ko', r.code) || ')',
            'achievement', r.id, null
          );
        exception when others then
          null; -- 포인트 지급 실패가 업적 획득을 막지 않게 한다
        end;
      end if;
    end if;
  end loop;

  return v_earned;
end;
$$;

revoke all on function band123.evaluate_achievements_for(uuid) from public;
grant execute on function band123.evaluate_achievements_for(uuid) to service_role;

-- 본인 업적 재평가 — 고객이 뱃지 페이지를 열 때 호출(트리거 누락분 자기치유).
create or replace function band123.claim_achievements()
returns int
language plpgsql
security definer
set search_path = band123
as $$
begin
  if auth.uid() is null then return 0; end if;
  return evaluate_achievements_for(auth.uid());
end;
$$;

revoke all on function band123.claim_achievements() from public;
grant execute on function band123.claim_achievements() to authenticated;

-- 관리자용 전체 재평가 — 업적을 새로 만들거나 조건을 바꾼 뒤 소급 적용할 때 쓴다.
create or replace function band123.reevaluate_all_achievements()
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare r record; v_total int := 0;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  for r in select id from profiles where role = 'customer' loop
    v_total := v_total + evaluate_achievements_for(r.id);
  end loop;
  return v_total;
end;
$$;

revoke all on function band123.reevaluate_all_achievements() from public;
grant execute on function band123.reevaluate_all_achievements() to authenticated;

-- 7) 평가 트리거 -------------------------------------------------------------
-- 7-1) 뉴스레터 구독 → 같은 이메일의 회원을 찾아 재평가
create or replace function band123.on_newsletter_subscribed()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare v_uid uuid;
begin
  begin
    select id into v_uid from profiles
     where lower(btrim(coalesce(email, ''))) = lower(btrim(coalesce(new.email, '')))
     limit 1;
    if v_uid is not null then perform evaluate_achievements_for(v_uid); end if;
  exception when others then
    null; -- 업적 평가 실패가 구독을 막지 않게 한다
  end;
  return new;
end;
$$;

drop trigger if exists newsletter_evaluate_achievements on band123.newsletter_subscribers;
create trigger newsletter_evaluate_achievements
  after insert on band123.newsletter_subscribers
  for each row execute function band123.on_newsletter_subscribed();

-- 7-2) 결제확정(0038 on_order_paid 확장) — 쿠폰 차감 + 구매 적립 + 업적 평가
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
  end if;
  return new;
end;
$$;

-- 7-3) 후기/문의 작성(0039 확장) — 포인트 지급 + 업적 평가
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
  return new;
end;
$$;

-- 8) 첫 시범 업적 시드 — '첫 구매' -------------------------------------------
-- 조건: 뉴스레터 구독 + 패스(티켓) 1개 이상 결제완료.
-- 뱃지 이미지는 어드민 > 업적관리 에서 등록한다(등록 전에는 기본 아이콘으로 표시).
insert into achievements (code, name_i18n, description_i18n, conditions, point_reward, sort_order)
values (
  'first_purchase',
  '{"ko":"첫 구매","en":"First Purchase"}'::jsonb,
  '{"ko":"뉴스레터를 구독하고 첫 패스를 구매하면 획득해요.","en":"Subscribe to the newsletter and buy your first pass."}'::jsonb,
  '[{"type":"newsletter_subscribed"},{"type":"ticket_purchase","count":1}]'::jsonb,
  0,
  1
)
on conflict (code) do nothing;

-- 9) 기존 회원 소급 평가 ------------------------------------------------------
do $$
declare r record;
begin
  for r in select id from profiles where role = 'customer' loop
    perform evaluate_achievements_for(r.id);
  end loop;
end;
$$;
