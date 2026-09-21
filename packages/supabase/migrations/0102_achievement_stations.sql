-- 0102: 현장 QR(업적 스테이션) — 참가자가 행사장에 붙은 QR 을 찍으면 업적을 받는다.
--
-- 흐름
--   운영진: 어드민 › 업적관리 › 현장 QR 에서 스테이션(QR)을 만든다 — 어느 업적용인지, 언제 유효한지.
--   참가자: 폰 카메라로 QR → /{locale}/qr/{code} → (로그인) → claim_station(code)
--           → 스캔 기록 → 업적 재평가 → 받았는지/몇 곳 남았는지 알려 준다.
--
-- 업적 조건: station_scan {count}
--   '이 업적에 연결된 현장 QR 중 서로 다른 count 곳을 찍었다'. 조식 뷔페 한 곳이면 1,
--   워크숍 세 곳이면 3. 조건 판정에는 어느 업적의 QR 인지가 필요해서, 평가 함수가 조건에
--   achievement_id 를 붙여 넘긴다(아래 evaluate_achievements_for).
--
-- 부정 방지(한계 포함)
--   · 로그인한 구매 회원만, QR 한 곳당 한 번만 센다.
--   · 유효 시간(valid_from ~ valid_until)을 건다 — '새벽 3시 이후', '소셜 시작 1시간' 같은 조건은
--     이 창으로 표현한다. 사진으로 찍어 돌려 쓰는 것까지는 막지 못한다 → 시간을 짧게 잡는 것이 방어선.
-- idempotent.

-- 1) 스테이션 ------------------------------------------------------------------
create table if not exists achievement_stations (
  id uuid primary key default gen_random_uuid(),
  -- QR 에 들어가는 짧은 코드. 추측하기 어렵게 무작위로 만든다(URL 에 그대로 노출된다).
  code text not null unique default lower(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 12)),
  achievement_id uuid not null references achievements(id) on delete cascade,
  -- 어느 행사의 QR 인지 — 스캔 화면에 행사 이름을 띄우고, 목록을 행사별로 거르는 데 쓴다(선택).
  product_id uuid references products(id) on delete set null,
  name text not null,                    -- 운영용 이름(예: 'Bohol 조식 뷔페 1일차')
  valid_from timestamptz,                -- 비우면 제한 없음
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists achievement_stations_achievement_idx on achievement_stations (achievement_id);

create table if not exists achievement_station_scans (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references achievement_stations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  unique (station_id, user_id)            -- 같은 QR 은 한 번만 센다
);

create index if not exists achievement_station_scans_user_idx on achievement_station_scans (user_id);

alter table achievement_stations enable row level security;
alter table achievement_station_scans enable row level security;

-- 스테이션 목록은 운영진만 본다 — 코드가 새면 현장에 가지 않고도 찍을 수 있다.
-- 참가자는 station_info(code) 로 '그 코드 하나' 만 확인한다.
drop policy if exists achievement_stations_admin on achievement_stations;
create policy achievement_stations_admin on achievement_stations
  for all using (is_admin()) with check (is_admin());

-- 스캔 기록: 본인 것 + 운영진. 쓰기는 claim_station 으로만.
drop policy if exists achievement_station_scans_select on achievement_station_scans;
create policy achievement_station_scans_select on achievement_station_scans
  for select using (user_id = auth.uid() or is_admin());

-- 2) 조건 판정 — station_scan 추가 -----------------------------------------------
-- 0101 의 함수 본문에 station_scan 한 갈래만 더한다(나머지는 그대로).
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
  v_days  int  := greatest(coalesce((p_cond->>'days')::int, 90), 1);
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

  elsif v_type = 'audience_judge_count' then
    select lower(btrim(coalesce(email, ''))) into v_email from profiles where id = p_user_id;
    if v_email is null or v_email = '' then return false; end if;
    begin
      select count(distinct j.contest_id) into v_n
        from public.online_judges j
       where lower(btrim(coalesce(j.email, ''))) = v_email;
    exception when others then
      return false;
    end;
    return coalesce(v_n, 0) >= v_count;

  elsif v_type = 'profile_complete' then
    return exists (
      select 1 from profiles p
       where p.id = p_user_id
         and btrim(coalesce(p.name, '')) <> ''
         and btrim(coalesce(p.phone, '')) <> ''
         and btrim(coalesce(p.country, '')) <> ''
         and (
           btrim(coalesce(p.avatar_url, '')) <> ''
           or (p.avatar_traits is not null and p.avatar_traits <> '{}'::jsonb and p.avatar_traits <> 'null'::jsonb)
         )
    );

  elsif v_type = 'ticket_order_count' then
    select count(distinct o.id) into v_n
      from orders o
      join order_items oi on oi.order_id = o.id
      join products pr on pr.id = oi.product_id
     where o.buyer_id = p_user_id
       and pr.product_type = 'ticket'
       and o.status in ('paid', 'shipped', 'done');
    return v_n >= v_count;

  elsif v_type = 'ticket_country_count' then
    select count(distinct upper(btrim(pr.event_content->>'country'))) into v_n
      from orders o
      join order_items oi on oi.order_id = o.id
      join products pr on pr.id = oi.product_id
     where o.buyer_id = p_user_id
       and pr.product_type = 'ticket'
       and o.status in ('paid', 'shipped', 'done')
       and btrim(coalesce(pr.event_content->>'country', '')) <> '';
    return v_n >= v_count;

  elsif v_type = 'early_bird_purchase' then
    begin
      select count(distinct o.id) into v_n
        from orders o
        join order_items oi on oi.order_id = o.id
        join products pr on pr.id = oi.product_id
       where o.buyer_id = p_user_id
         and pr.product_type = 'ticket'
         and o.status in ('paid', 'shipped', 'done')
         and btrim(coalesce(pr.event_content->>'startAt', '')) <> ''
         and coalesce(o.paid_at, o.created_at)
             <= ((pr.event_content->>'startAt')::timestamp at time zone 'Asia/Seoul') - make_interval(days => v_days);
    exception when others then
      return false;
    end;
    return coalesce(v_n, 0) >= v_count;

  elsif v_type = 'referral_signup_count' then
    select count(*) into v_n
      from profiles f
     where f.referred_by = p_user_id
       and f.role = 'customer'
       and check_achievement_condition(f.id, '{"type":"profile_complete"}'::jsonb);
    return v_n >= v_count;

  elsif v_type = 'referral_purchase_count' then
    select count(distinct f.id) into v_n
      from profiles f
      join orders o on o.buyer_id = f.id
      join order_items oi on oi.order_id = o.id
      join products pr on pr.id = oi.product_id
     where f.referred_by = p_user_id
       and pr.product_type = 'ticket'
       and o.status in ('paid', 'shipped', 'done');
    return v_n >= v_count;

  elsif v_type = 'ticket_checkin_count' then
    select count(*) into v_n
      from orders o
      join order_items oi on oi.order_id = o.id
     where o.buyer_id = p_user_id
       and oi.checked_in_at is not null;
    return v_n >= v_count;

  elsif v_type = 'feedback_submitted' then
    begin
      select count(*) into v_n from event_feedback where author_id = p_user_id;
    exception when others then
      return false;
    end;
    return coalesce(v_n, 0) >= v_count;

  -- ── 0102 추가 ──────────────────────────────────────────────────────────────
  elsif v_type = 'station_scan' then
    -- 어느 업적의 QR 인지는 평가 함수가 achievement_id 로 붙여 준다. 없으면 판정할 수 없다.
    if coalesce(p_cond->>'achievement_id', '') = '' then return false; end if;
    select count(distinct s.station_id) into v_n
      from achievement_station_scans s
      join achievement_stations st on st.id = s.station_id
     where s.user_id = p_user_id
       and st.achievement_id = (p_cond->>'achievement_id')::uuid;
    return v_n >= v_count;

  elsif v_type = 'manual' then
    return false;
  end if;

  return false;
end;
$$;

revoke all on function band123.check_achievement_condition(uuid, jsonb) from public;
grant execute on function band123.check_achievement_condition(uuid, jsonb) to service_role;

-- 3) 평가 — 조건에 achievement_id 를 붙여 넘긴다 ---------------------------------
-- 0040 과 같되, 조건마다 어느 업적의 조건인지를 알려 준다(station_scan 이 쓴다).
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
      if not check_achievement_condition(
        p_user_id,
        (v_conds -> i) || jsonb_build_object('achievement_id', r.id)
      ) then
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

-- 4) QR 정보 — 로그인 전 화면용 --------------------------------------------------
-- 코드 하나에 대해서만 답한다(목록은 주지 않는다). 업적 이름·뱃지·유효 시간·행사 이름.
create or replace function band123.station_info(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = band123
as $$
  select jsonb_build_object(
    'station', st.name,
    'achievement_code', a.code,
    'achievement_name', a.name_i18n,
    'achievement_description', a.description_i18n,
    'badge_image_url', a.badge_image_url,
    'point_reward', a.point_reward,
    'event_name', pr.name_i18n,
    'valid_from', st.valid_from,
    'valid_until', st.valid_until,
    'open', st.is_active and a.is_active
            and (st.valid_from is null or now() >= st.valid_from)
            and (st.valid_until is null or now() <= st.valid_until)
  )
    from achievement_stations st
    join achievements a on a.id = st.achievement_id
    left join products pr on pr.id = st.product_id
   where st.code = lower(btrim(p_code));
$$;

revoke all on function band123.station_info(text) from public;
grant execute on function band123.station_info(text) to anon, authenticated;

-- 5) QR 찍기 -------------------------------------------------------------------
-- 결과(status):
--   granted      이번 스캔으로 업적을 받았다
--   progress     찍었지만 아직 조건이 남았다(scanned / required 로 몇 곳인지)
--   already      이미 가진 업적
--   scanned      이 QR 은 이미 찍었다(업적은 아직)
--   not_open     아직 유효 시간이 아니다 / not_found · closed · login · not_customer
create or replace function band123.claim_station(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid      uuid := auth.uid();
  st         achievement_stations%rowtype;
  a          achievements%rowtype;
  v_new_scan boolean;
  v_required int;
  v_scanned  int;
begin
  if v_uid is null then return jsonb_build_object('status', 'login'); end if;

  select * into st from achievement_stations where code = lower(btrim(p_code));
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into a from achievements where id = st.achievement_id;

  if not (st.is_active and a.is_active) then return jsonb_build_object('status', 'closed'); end if;
  if st.valid_from is not null and now() < st.valid_from then
    return jsonb_build_object('status', 'not_open', 'valid_from', st.valid_from);
  end if;
  if st.valid_until is not null and now() > st.valid_until then
    return jsonb_build_object('status', 'closed', 'valid_until', st.valid_until);
  end if;
  if not exists (select 1 from profiles where id = v_uid and role = 'customer') then
    return jsonb_build_object('status', 'not_customer');
  end if;

  if exists (select 1 from user_achievements where user_id = v_uid and achievement_id = a.id) then
    return jsonb_build_object('status', 'already');
  end if;

  insert into achievement_station_scans(station_id, user_id)
  values (st.id, v_uid)
  on conflict (station_id, user_id) do nothing;
  v_new_scan := found;

  -- 스캔이 조건을 채웠는지 — 다른 조건(있다면)까지 한꺼번에 본다.
  begin
    perform evaluate_achievements_for(v_uid);
  exception when others then
    null;
  end;

  if exists (select 1 from user_achievements where user_id = v_uid and achievement_id = a.id) then
    return jsonb_build_object('status', 'granted', 'point_reward', a.point_reward);
  end if;

  select coalesce(max(greatest(coalesce((c->>'count')::int, 1), 1)), 1) into v_required
    from jsonb_array_elements(coalesce(a.conditions, '[]'::jsonb)) c
   where c->>'type' = 'station_scan';
  select count(distinct s.station_id) into v_scanned
    from achievement_station_scans s
    join achievement_stations x on x.id = s.station_id
   where s.user_id = v_uid and x.achievement_id = a.id;

  return jsonb_build_object(
    'status', case when v_new_scan then 'progress' else 'scanned' end,
    'scanned', v_scanned,
    'required', v_required
  );
end;
$$;

revoke all on function band123.claim_station(text) from public;
grant execute on function band123.claim_station(text) to authenticated;

-- 6) 현장형 업적에 조건을 걸어 둔다 ---------------------------------------------------
-- 0101 에서 '판정 수단 없음' 으로 비워 둔 오프라인 업적들. 켜는 것은 운영진이 QR 을 만든 뒤에 한다
-- (여기서는 is_active 를 건드리지 않는다). 조건이 이미 있으면 덮지 않는다.
update achievements
   set conditions = case code
         when 'workshop_warrior' then '[{"type":"station_scan","count":3}]'::jsonb
         else '[{"type":"station_scan","count":1}]'::jsonb
       end
 where code in ('oasis', 'breakfast_club', 'icebreaker', 'sunrise_survivor', 'splash_zone',
                'the_chameleon', 'workshop_warrior', 'bootcamp_veteran', 'the_tracker')
   and coalesce(jsonb_array_length(conditions), 0) = 0;
