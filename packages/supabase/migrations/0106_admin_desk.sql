-- 0106: 어드민 현장 데스크 + 업적 획득 알림
--
-- (1) 현장 데스크 — 운영진이 고객 QR(패스 시크릿 · 회원 코드 · 주문번호)을 찍어 입장 처리한다.
--     0026 checkin_pass 는 '내가 판 패스'만 소각한다(오거나이저용). 운영진은 어느 판매자 것이든 처리해야
--     하므로 is_admin() 으로 갈음한 admin_checkin_pass 를 둔다. 소각 규칙·카운터 미러는 0026 과 같다.
-- (2) 업적 획득 알림 — user_achievements 에 행이 생기면(자동 판정 · 수동 지급 · 현장 QR 모두) 회원 알림함
--     (member_notices, 0080)에 한 건 넣는다. 트리거 함수는 security definer — 지급 경로가 어느 권한이든
--     알림은 같은 규칙으로 들어가야 해서.
-- idempotent.

-- ── 1) 운영진 패스 소각 ─────────────────────────────────────────────────────────
drop function if exists band123.admin_checkin_pass(uuid);
create function band123.admin_checkin_pass(p_secret uuid)
returns table (
  order_no     text,
  product_name jsonb,
  owner_id     uuid,
  owner_name   text,
  pass_status  text,
  already      boolean
)
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid := auth.uid();
  v_burned passes;
  v_pass passes;
  v_order orders;
  v_product products;
  v_owner profiles;
begin
  if v_uid is null or not band123.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update passes
    set status = 'used', used_at = now(), used_by = v_uid
    where redemption_secret = p_secret and status = 'valid'
    returning * into v_burned;

  if found then
    update order_items
      set checked_in_count = checked_in_count + 1,
          checked_in_at = coalesce(checked_in_at, now()),
          checked_in_by = coalesce(checked_in_by, v_uid)
      where id = v_burned.order_item_id;
    select * into v_order from orders where id = v_burned.order_id;
    select * into v_product from products where id = v_burned.product_id;
    select * into v_owner from profiles where id = v_burned.owner_id;
    return query select
      v_order.order_no,
      coalesce(v_product.name_i18n, '{}'::jsonb),
      v_burned.owner_id,
      coalesce(nullif(trim(v_owner.name), ''), v_owner.email),
      'used'::text,
      false;
    return;
  end if;

  select * into v_pass from passes where redemption_secret = p_secret;
  if not found then raise exception 'pass_not_found' using errcode = 'P0002'; end if;
  select * into v_order from orders where id = v_pass.order_id;
  select * into v_product from products where id = v_pass.product_id;
  select * into v_owner from profiles where id = v_pass.owner_id;
  return query select
    v_order.order_no,
    coalesce(v_product.name_i18n, '{}'::jsonb),
    v_pass.owner_id,
    coalesce(nullif(trim(v_owner.name), ''), v_owner.email),
    v_pass.status,
    true;
end;
$$;
revoke all on function band123.admin_checkin_pass(uuid) from public;
grant execute on function band123.admin_checkin_pass(uuid) to authenticated;

-- ── 2) 업적 획득 알림 ──────────────────────────────────────────────────────────
-- 제목·본문은 한 줄에 한국어·영어를 같이 적는다 — 알림함은 회원 언어별 본문을 따로 두지 않는다(0080).
create or replace function band123.notify_achievement_earned()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_a achievements;
  v_ko text;
  v_en text;
  v_points text := '';
begin
  select * into v_a from achievements where id = new.achievement_id;
  if not found then return new; end if;
  v_ko := coalesce(nullif(v_a.name_i18n->>'ko', ''), v_a.name_i18n->>'en', v_a.code);
  v_en := coalesce(nullif(v_a.name_i18n->>'en', ''), v_a.name_i18n->>'ko', v_a.code);
  if coalesce(v_a.point_reward, 0) > 0 then
    v_points := ' (+' || v_a.point_reward || ' P)';
  end if;

  insert into member_notices (user_id, title, body, link_url)
  values (
    new.user_id,
    '🏅 새 뱃지 · New badge',
    '「' || v_ko || '」 뱃지를 받았어요!' || v_points || E'\n' ||
    'You earned the “' || v_en || '” badge!' || v_points || E'\n\n' ||
    '마이페이지 › 업적·뱃지 · My Page › Achievements & badges',
    'https://123band-web.vercel.app/account/badges'
  );
  return new;
exception when others then
  -- 알림이 실패해도 업적 지급은 막지 않는다.
  return new;
end;
$$;

drop trigger if exists trg_notify_achievement_earned on band123.user_achievements;
create trigger trg_notify_achievement_earned
  after insert on band123.user_achievements
  for each row execute function band123.notify_achievement_earned();

notify pgrst, 'reload schema';
