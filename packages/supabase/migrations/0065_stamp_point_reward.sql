-- 0065: 스탬프 카드 완성 보상을 "10% 할인 쿠폰" → "포인트 지급" 으로 바꾼다.
-- 배경: 쿠폰은 결제창에 코드를 옮겨 적어야 쓸 수 있고 유효기간이 지나면 사라진다.
--   포인트는 이미 있는 지갑에 바로 쌓이고(0037) 쿠폰 교환(0038)도 되므로,
--   같은 보상을 주면서 회원이 쓸 방법은 더 넓어진다.
-- 바뀌는 것은 "카드가 찼을 때 무엇을 주는가" 하나뿐이다 —
--   도장을 모으는 규칙(award_stamps/훅 4종/중복방지)은 0062 그대로다.
--
-- 정책값 교체: reward_coupon_id·coupon_valid_days(쿠폰용) → reward_points(기본 300).
--   0 이면 보상을 주지 않고 도장만 계속 쌓인다(쿠폰 미지정 때와 같은 동작).
-- 지난 기록은 건드리지 않는다 — 이미 발급된 스탬프 쿠폰(user_coupons.source='stamp_reward')과
--   원장의 'coupon_reward' 행은 그대로 남는다(회원 쿠폰함에서 계속 쓸 수 있다).
-- idempotent.

-- 1) 원장 구분값 확장 --------------------------------------------------------
-- 포인트 원장: 스탬프 카드 완성 보상.
-- 0039·0040 과 같은 방식 — 이름을 가정하지 않고 reason 을 참조하는 check 를 모두 지운 뒤 새로 만든다.
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
  'achievement',
  'stamp_reward'  -- 스탬프 카드 완성 보상
));

-- 스탬프 원장: 카드 완성 소진의 새 이름. 'coupon_reward' 는 지난 기록이 있으니 남겨둔다.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'band123'
      and rel.relname = 'stamp_ledger'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%reason%'
  loop
    execute format('alter table band123.stamp_ledger drop constraint %I', r.conname);
  end loop;
end;
$$;
alter table stamp_ledger add constraint stamp_ledger_reason_check check (reason in (
  'order_paid',
  'checkin',
  'review_write',
  'qna_write',
  'admin_grant',
  'admin_deduct',
  'coupon_reward',  -- (지난 기록) 카드 완성 → 쿠폰 발급하며 소진
  'point_reward'    -- 카드 완성 → 포인트 지급하며 소진
));

-- 2) 정책값 교체 -------------------------------------------------------------
-- 새 설치용 기본값. 이미 있으면 아래 update 가 쿠폰 키만 걷어낸다.
insert into app_settings(key, value)
values ('stamps.policy', jsonb_build_object(
  'enabled', true,
  'goal', 10,
  'reward_points', 300,
  'per_order', 1,
  'per_checkin', 1,
  'per_review', 1,
  'per_qna', 1
))
on conflict (key) do nothing;

-- 기존 정책: 쿠폰용 키를 지우고 reward_points 를 넣는다(이미 있으면 운영자가 정한 값을 지킨다).
update app_settings
   set value = (coalesce(value, '{}'::jsonb) - 'reward_coupon_id' - 'coupon_valid_days')
               || jsonb_build_object('reward_points', coalesce((value->>'reward_points')::int, 300)),
       updated_at = now()
 where key = 'stamps.policy';

-- 3) 카드 완성 → 포인트 지급 --------------------------------------------------
-- 도장이 goal 이상이면 reward_points 를 지급하고 goal 만큼 소진한다. 남은 도장은 다음 카드로 이월된다.
-- 반환값은 이번에 정산된 카드 수(0 = 아직 안 참 또는 보상 미설정).
create or replace function band123.redeem_stamp_card(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_policy jsonb := stamps_policy();
  v_goal int := coalesce((v_policy->>'goal')::int, 0);
  v_points int := coalesce((v_policy->>'reward_points')::int, 0);
  v_count int;
  v_stamp stamp_ledger;
  v_total int := 0;
  v_guard int := 0;
begin
  -- 보상이 0 이면 아무것도 하지 않는다 → 도장은 그대로 쌓이고,
  -- 나중에 운영자가 값을 넣으면 그때 밀린 카드가 한꺼번에 정산된다(claim_stamp_card).
  if p_user_id is null or v_goal <= 0 or v_points <= 0 then return 0; end if;

  loop
    v_guard := v_guard + 1;
    exit when v_guard > 10; -- 폭주 방지(정책 오설정으로 무한 지급되는 것을 막는다)

    select coalesce(stamp_count, 0) into v_count from profiles where id = p_user_id;
    exit when v_count < v_goal;

    -- 도장을 먼저 소진하고, 그 원장 행을 근거(ref)로 포인트를 지급한다.
    -- 두 원장이 서로를 가리키므로 나중에 "이 포인트가 어느 카드에서 나왔는지" 추적된다.
    v_stamp := stamps_apply(
      p_user_id, -v_goal, 'point_reward',
      '스탬프 카드 완성 — ' || v_points || 'P 지급', 'stamp_card', null
    );
    perform points_apply(
      p_user_id, v_points, 'stamp_reward',
      '스탬프 카드 완성 보상', 'stamp', v_stamp.id
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

revoke all on function band123.redeem_stamp_card(uuid) from public;
grant execute on function band123.redeem_stamp_card(uuid) to service_role;

-- 4) 카드 완성 알림 웹훅 ------------------------------------------------------
-- 0064 는 user_coupons INSERT 를 잡아 운영자에게 알렸다. 이제 카드 완성은 쿠폰을 만들지 않으므로
-- 그 경로로는 잡히지 않는다 → 포인트 원장의 'stamp_reward' 행을 같은 방식으로 알린다.
-- 수신 URL/시크릿은 0064 의 app_settings('notify.webhook') 을 그대로 쓴다(설정 추가 없음).
create or replace function band123.notify_stamp_reward()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_cfg jsonb;
  v_url text;
  v_secret text;
begin
  if new.reason is distinct from 'stamp_reward' then return new; end if;

  select value into v_cfg from app_settings where key = 'notify.webhook';
  v_url := nullif(btrim(coalesce(v_cfg->>'url', '')), '');
  v_secret := coalesce(v_cfg->>'secret', '');
  if v_url is null then return new; end if;

  -- ⚠️ pg_net 은 확장이 extensions 스키마에 설치돼도 함수는 net 스키마에 만든다(0064 주석 참고).
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('pointLedgerId', new.id, 'source', 'stamp_reward'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  -- 알림 실패가 포인트 지급을 되돌리면 안 된다. 설정 오류는 찾을 수 있게 경고만 남긴다.
  raise warning '[notify_stamp_reward] 전송 실패: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists point_ledger_notify_stamp_reward on band123.point_ledger;
create trigger point_ledger_notify_stamp_reward
  after insert on band123.point_ledger
  for each row execute function band123.notify_stamp_reward();

-- 5) 대시보드 집계 갱신 -------------------------------------------------------
-- '미사용 스탬프 쿠폰' 은 더 이상 늘지 않는 지난 지표다 → '스탬프로 지급한 포인트 누계'로 바꾼다.
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
    'point_outstanding', coalesce((select sum(point_balance) from profiles), 0),
    'point_holders',     (select count(*) from profiles where coalesce(point_balance, 0) > 0),
    'stamp_holders',     (select count(*) from profiles where coalesce(stamp_count, 0) > 0),
    -- 카드 완성 누적 = 소진 원장 건수. 쿠폰 시절(coupon_reward) 기록도 같이 센다.
    'stamp_cards_done',  (select count(*) from stamp_ledger where reason in ('coupon_reward', 'point_reward')),
    -- 카드 완성으로 나간 포인트 누계(부채가 아니라 지급 실적).
    'stamp_points_paid',
      (select coalesce(sum(delta), 0) from point_ledger where reason = 'stamp_reward')
  ) into v;

  return v;
end;
$$;

revoke all on function band123.admin_loyalty_stats() from public;
grant execute on function band123.admin_loyalty_stats() to authenticated;
