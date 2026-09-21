-- 0103: 행사 전용 업적(뱃지)
--
-- 업적은 기본적으로 모든 행사에 공통이다. product_id 를 넣으면 그 행사(패스 상품) 전용이 된다.
--   · 조건은 그 행사 기록만 센다: 패스 구매 · 패스 주문 · 얼리버드 · 입장 체크인 · 후기 · 문의 · 피드백 설문.
--   · 행사와 무관한 조건(뉴스레터 · 프로필 · 추천 · 보유 포인트 · 관객 심사 · 전체 주문)은 그대로 센다.
--   · 현장 QR(station_scan)은 원래 업적별 QR 이라 그대로다.
--   · 행사 상품이 지워지면 product_id 는 null(=공통)이 된다 — 어드민 목록에서 '공통' 으로 보이니 바로 알아챈다.

alter table achievements add column if not exists product_id uuid references products(id) on delete set null;
create index if not exists achievements_product_idx on achievements (product_id) where product_id is not null;
comment on column achievements.product_id is '행사 전용 업적이면 그 행사(패스 상품) id. null = 모든 행사 공통.';

-- 1) 조건 판정 — 행사 범위(product_id) 지원 ----------------------------------------
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
  -- 행사 전용 업적이면 평가 함수가 product_id 를 붙여 준다 → 그 행사 것만 센다.
  v_pid   uuid := nullif(p_cond->>'product_id', '')::uuid;
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
       and o.status in ('paid', 'shipped', 'done')
       and (v_pid is null or pr.id = v_pid);
    return v_n >= v_count;

  elsif v_type = 'order_count' then
    select count(*) into v_n from orders
     where buyer_id = p_user_id and status in ('paid', 'shipped', 'done');
    return v_n >= v_count;

  elsif v_type = 'review_count' then
    select count(*) into v_n from product_reviews
     where author_id = p_user_id and (v_pid is null or product_id = v_pid);
    return v_n >= v_count;

  elsif v_type = 'qna_count' then
    select count(*) into v_n from product_qna
     where author_id = p_user_id and (v_pid is null or product_id = v_pid);
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
       and o.status in ('paid', 'shipped', 'done')
       and (v_pid is null or pr.id = v_pid);
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
         and (v_pid is null or pr.id = v_pid)
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
       and oi.checked_in_at is not null
       and (v_pid is null or oi.product_id = v_pid);
    return v_n >= v_count;

  elsif v_type = 'feedback_submitted' then
    begin
      select count(*) into v_n from event_feedback
       where author_id = p_user_id and (v_pid is null or product_id = v_pid);
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

-- 2) 평가 — 조건에 achievement_id · (행사 전용이면) product_id 를 붙여 넘긴다 -----------
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
        (v_conds -> i)
          || jsonb_build_object('achievement_id', r.id)
          -- 행사 전용 업적 — 그 행사 기록만 세도록 행사 id 를 붙인다.
          || case when r.product_id is null then '{}'::jsonb
                  else jsonb_build_object('product_id', r.product_id) end
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


-- 3) 스키마 캐시 --------------------------------------------------------------------
notify pgrst, 'reload schema';
