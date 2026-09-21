-- Design Ref: 업적 달성 조건에 '관객 심사위원 참가' 추가.
--
-- 관객 심사위원 접수는 우리 앱이 아니라 J&J Dash 가 받는다(/ojudge/{code} → online_judges).
-- 그 테이블이 같은 Supabase 프로젝트에 있어서 셀 수는 있는데, 회원 id 로는 이어지지 않는다
-- (Dash 는 우리 회원 체계를 모른다). 그래서 뉴스레터 조건과 같은 방식으로 이메일을 맞춘다.
--
-- '몇 번 참가했나' 는 행 수가 아니라 '대회 수(contest_id)'로 센다.
--   한 대회에서 부문이 여럿이면 행이 여러 개 생길 수 있는데, 그걸 3회 참가로 치면
--   한 대회만 나가고도 '3개 대회 참가' 뱃지를 받게 된다.
--
-- 접수만 하고 실제 심사를 안 한 사람도 센다. submitted_at 을 요구하면 대회가 아직 안 열린
-- 참가자가 빠지고, 그 사람은 '왜 뱃지가 안 나오지' 를 대회 끝날 때까지 알 수 없다.
-- 실제 제출까지 요구하고 싶어지면 아래 exists 절에 조건 한 줄만 더하면 된다.
--
-- idempotent: create or replace.

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

  elsif v_type = 'audience_judge_count' then
    -- 남의 앱 테이블이다. 없거나 이름이 바뀌어도 업적 평가 전체가 멈추면 안 되므로 감싼다.
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
  end if;

  return false;
end;
$$;

revoke all on function band123.check_achievement_condition(uuid, jsonb) from public;
grant execute on function band123.check_achievement_condition(uuid, jsonb) to service_role;

comment on function band123.check_achievement_condition(uuid, jsonb) is
  '업적 조건 1개 판정. audience_judge_count 는 J&J Dash 의 online_judges 를 이메일로 맞춰 대회 수로 센다.';

-- ── 접수 즉시 평가 ──────────────────────────────────────────────────────────
-- online_judges 는 J&J Dash 소유 테이블이다. 우리가 트리거를 다는 이상, 우리 쪽 오류가
-- 그 앱의 접수를 막아서는 절대 안 된다 → 전 구간을 exception 으로 감싸고 항상 new 를 돌려준다.
-- (트리거가 없으면 뱃지는 어드민의 '전체 회원 재평가' 를 눌러야 붙는다.)
create or replace function band123.on_online_judge_signup()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_uid uuid;
begin
  begin
    select p.id into v_uid
      from profiles p
     where lower(btrim(coalesce(p.email, ''))) = lower(btrim(coalesce(new.email, '')))
     limit 1;
    if v_uid is not null then
      perform evaluate_achievements_for(v_uid);
    end if;
  exception when others then
    null; -- 업적 부여 실패가 심사위원 접수를 되돌리면 안 된다
  end;
  return new;
end;
$$;

drop trigger if exists band123_online_judge_evaluate_achievements on public.online_judges;
create trigger band123_online_judge_evaluate_achievements
  after insert on public.online_judges
  for each row execute function band123.on_online_judge_signup();
