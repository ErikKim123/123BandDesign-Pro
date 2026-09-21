-- 0101: 업적 카탈로그 정리 — 운영팀 기획서(드라이브 '온라인/오프라인 업적 종류')를 등록한다.
--
-- 무엇이 바뀌나
--   1) achievements.track        : 업적 묶음(트랙). 배지 페이지가 트랙별로 묶어 보여 준다.
--   2) 자동 판정 조건 8종 추가   : 프로필 완성 · 패스 주문 수 · 방문 국가 수 · 얼리버드 ·
--                                   추천 가입 · 추천 구매 · 입장 체크인 · 피드백 설문 제출
--      + 'manual' 표시            : 자동으로는 절대 달성되지 않고 운영진이 직접 지급한다.
--   3) 재평가 트리거             : 프로필 수정 · 추천 연결 · 결제(추천인) · 입장 체크인 · 설문 제출
--   4) 수동 지급/회수 함수       : admin_grant_achievement / admin_revoke_achievement
--   5) 카탈로그 시드             : 기획서의 29개(온라인 16 · 오프라인 13). 판정 수단이 아직 없는
--                                   업적은 비활성으로 넣어 둔다(고객에게 '딸 수 없는 뱃지'를 보이지 않게).
--   6) 기존 '관객심사위원' 정리   : 조건이 비어 있어 아무에게도 지급되지 않던 것을 고친다.
--
-- 전체 목록과 각 업적의 판정 방식·미구현 사유는 docs/achievements.md 에 적는다.
-- idempotent — add column if not exists / create or replace / on conflict.

-- 1) 트랙 ---------------------------------------------------------------------
alter table achievements add column if not exists track text;
comment on column achievements.track is
  '업적 묶음: onboarding·purchaser·critic·den·hustler·explorer·diehard(온라인) / logistics·party·grind·arena(오프라인)';

-- 2) 조건 판정 ---------------------------------------------------------------
-- 기존 조건(뉴스레터·패스구매·주문·후기·문의·포인트·관객심사)은 0095 그대로 두고 아래를 더한다.
--   profile_complete                 이름·연락처·국가 + 프로필 사진 또는 캐릭터
--   ticket_order_count {count}       패스가 든 결제완료 주문 '건수' (수량 합계가 아니다 — 한 번에 3장 사도 1회)
--   ticket_country_count {count}     결제완료 패스의 행사 국가(event_content.country) 종류 수
--   early_bird_purchase {count,days} 행사 시작 days(기본 90)일 이상 전에 결제한 패스 주문 수
--   referral_signup_count {count}    내 추천으로 가입해 프로필까지 완성한 회원 수
--   referral_purchase_count {count}  내 추천으로 가입해 패스를 결제한 회원 수
--   ticket_checkin_count {count}     입장 확인(QR 스캔)된 내 패스 수
--   feedback_submitted {count}       로그인 상태로 낸 행사 피드백 설문 수
--   manual                           항상 거짓 — 운영진이 admin_grant_achievement 로 지급
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

  -- ── 0101 추가 ──────────────────────────────────────────────────────────────
  elsif v_type = 'profile_complete' then
    -- 연락처·국가는 가입 때 받고, 이름·사진/캐릭터는 마이페이지에서 고친다. 넷 다 있어야 '완성'.
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
    -- 국가는 행사 기본정보의 ISO 코드(event_content.country). 비어 있는 행사(온라인 공연 등)는 세지 않는다.
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
    -- startAt 은 시간대 없는 datetime-local — 사이트 전체 규칙대로 KST 로 읽는다.
    -- 형식이 깨진 행사 하나 때문에 평가 전체가 멈추지 않게 감싼다.
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
    -- 비로그인 응답은 누구 것인지 알 수 없어 세지 못한다(설문 화면이 그렇게 안내한다).
    begin
      select count(*) into v_n from event_feedback where author_id = p_user_id;
    exception when others then
      return false;
    end;
    return coalesce(v_n, 0) >= v_count;

  elsif v_type = 'manual' then
    return false;
  end if;

  return false;
end;
$$;

revoke all on function band123.check_achievement_condition(uuid, jsonb) from public;
grant execute on function band123.check_achievement_condition(uuid, jsonb) to service_role;

-- 3) 재평가 트리거 -------------------------------------------------------------
-- 모든 트리거는 '평가 실패가 원래 동작(저장·결제·체크인·설문)을 막지 않게' 감싼다.

-- 3-1) 프로필 — 본인(프로필 완성) + 나를 추천한 사람(추천 가입 수)
--   열을 지정한 트리거라 포인트 지급(point_balance 갱신)으로는 다시 불리지 않는다 → 재귀 없음.
create or replace function band123.on_profile_achievement_fields()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  begin
    perform evaluate_achievements_for(new.id);
  exception when others then
    null;
  end;
  if new.referred_by is not null then
    begin
      perform evaluate_achievements_for(new.referred_by);
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_evaluate_achievements on band123.profiles;
create trigger profiles_evaluate_achievements
  after update of name, phone, country, avatar_url, avatar_traits, referred_by on band123.profiles
  for each row
  when (
    old.name is distinct from new.name
    or old.phone is distinct from new.phone
    or old.country is distinct from new.country
    or old.avatar_url is distinct from new.avatar_url
    or old.avatar_traits is distinct from new.avatar_traits
    or old.referred_by is distinct from new.referred_by
  )
  execute function band123.on_profile_achievement_fields();

-- 3-2) 결제확정 — 구매자 본인은 기존 on_order_paid 가 평가한다. 여기서는 '구매자를 추천한 사람'.
create or replace function band123.on_order_paid_referrer()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare v_ref uuid;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'paid') then
    begin
      select referred_by into v_ref from profiles where id = new.buyer_id;
      if v_ref is not null then perform evaluate_achievements_for(v_ref); end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_paid_referrer_achievements on band123.orders;
create trigger orders_paid_referrer_achievements
  after insert or update of status on band123.orders
  for each row execute function band123.on_order_paid_referrer();

-- 3-3) 입장 체크인 — 처음 체크인되는 순간 구매자를 평가(First Contact)
create or replace function band123.on_ticket_checked_in()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare v_buyer uuid;
begin
  if new.checked_in_at is not null and old.checked_in_at is null then
    begin
      select buyer_id into v_buyer from orders where id = new.order_id;
      if v_buyer is not null then perform evaluate_achievements_for(v_buyer); end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_checkin_achievements on band123.order_items;
create trigger order_items_checkin_achievements
  after update of checked_in_at on band123.order_items
  for each row execute function band123.on_ticket_checked_in();

-- 3-4) 피드백 설문 제출 — 로그인한 응답자만(The Final Word)
create or replace function band123.on_feedback_submitted()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  begin
    perform evaluate_achievements_for(new.author_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists event_feedback_achievements on band123.event_feedback;
create trigger event_feedback_achievements
  after insert on band123.event_feedback
  for each row
  when (new.author_id is not null)
  execute function band123.on_feedback_submitted();

-- 4) 수동 지급 / 회수 -----------------------------------------------------------
-- 현장 스캔형(오프라인)·SNS 태그·버그 제보처럼 시스템이 스스로 판정할 수 없는 업적용.
-- 자동 지급과 똑같이 보상 포인트를 준다. 회수는 뱃지만 거둔다(포인트는 어드민 '포인트 차감'으로 따로).
create or replace function band123.admin_grant_achievement(p_user_id uuid, p_achievement_id uuid)
returns boolean
language plpgsql
security definer
set search_path = band123
as $$
declare r achievements%rowtype;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select * into r from achievements where id = p_achievement_id;
  if not found then raise exception 'achievement_not_found'; end if;
  -- 배지 페이지는 구매 회원 전용이다 — 자동 지급과 같은 대상으로 맞춘다.
  if not exists (select 1 from profiles where id = p_user_id and role = 'customer') then
    raise exception 'customer_not_found';
  end if;

  insert into user_achievements(user_id, achievement_id)
  values (p_user_id, p_achievement_id)
  on conflict (user_id, achievement_id) do nothing;
  if not found then return false; end if; -- 이미 가진 뱃지

  if coalesce(r.point_reward, 0) > 0 then
    begin
      perform points_apply(
        p_user_id, r.point_reward, 'achievement',
        '업적 달성 보상 (' || coalesce(r.name_i18n->>'ko', r.code) || ', 수동 지급)',
        'achievement', r.id, null
      );
    exception when others then
      null; -- 포인트 지급 실패가 지급 자체를 되돌리지 않게 한다(자동 지급과 같은 규칙)
    end;
  end if;
  return true;
end;
$$;

revoke all on function band123.admin_grant_achievement(uuid, uuid) from public;
grant execute on function band123.admin_grant_achievement(uuid, uuid) to authenticated;

create or replace function band123.admin_revoke_achievement(p_user_id uuid, p_achievement_id uuid)
returns boolean
language plpgsql
security definer
set search_path = band123
as $$
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from user_achievements where user_id = p_user_id and achievement_id = p_achievement_id;
  return found;
end;
$$;

revoke all on function band123.admin_revoke_achievement(uuid, uuid) from public;
grant execute on function band123.admin_revoke_achievement(uuid, uuid) to authenticated;

-- 5) 카탈로그 시드 -------------------------------------------------------------
-- sort_order = 트랙 번호 × 100 + 순번. 이미 있는 코드는 건드리지 않는다(어드민이 고친 문구를 덮지 않게).
-- 판정 수단이 없는 업적은 is_active=false, conditions='[]' 로 둔다 — 기능이 생기면 조건을 넣고 켠다.
-- 오프라인 업적의 보상 포인트는 기획서에 없어 0 으로 둔다.
insert into achievements (code, track, name_i18n, description_i18n, conditions, point_reward, is_active, sort_order)
values
  -- ── 온라인 · 시작하기 ──
  ('profile_complete', 'onboarding',
   '{"ko":"준비 완료","en":"Profile Complete"}',
   '{"ko":"이름·연락처·국가와 프로필 사진(또는 캐릭터)까지 프로필을 모두 채우면 획득해요.","en":"Fill out every profile detail — name, phone, country and a photo or character."}',
   '[{"type":"profile_complete"}]', 200, true, 102),
  ('first_den_post', 'onboarding',
   '{"ko":"무리 합류","en":"First Den Post"}',
   '{"ko":"아지트에 첫 글을 쓰면 획득해요.","en":"Write your first post in the Den."}',
   '[]', 300, false, 103),
  ('first_review', 'onboarding',
   '{"ko":"첫 리뷰","en":"First Review"}',
   '{"ko":"행사 후기를 처음 남기면 획득해요.","en":"Leave your first festival review."}',
   '[{"type":"review_count","count":1}]', 500, true, 104),
  -- ── 온라인 · 구매 ──
  ('first_blood', 'purchaser',
   '{"ko":"첫 결제","en":"First Blood"}',
   '{"ko":"123Band에서 첫 페스티벌 패스를 결제하면 획득해요.","en":"Purchase your first festival pass on 123Band."}',
   '[{"type":"ticket_order_count","count":1}]', 500, true, 201),
  ('frequent_flyer', 'purchaser',
   '{"ko":"단골 손님","en":"Frequent Flyer"}',
   '{"ko":"페스티벌 패스를 세 번째로 결제하면 획득해요.","en":"Complete your third festival pass purchase."}',
   '[{"type":"ticket_order_count","count":3}]', 1000, true, 202),
  -- ── 온라인 · 리뷰 ──
  ('voice_of_the_people', 'critic',
   '{"ko":"여론 주도자","en":"Voice of the People"}',
   '{"ko":"행사 후기를 5개 남기면 획득해요.","en":"Leave 5 festival reviews."}',
   '[{"type":"review_count","count":5}]', 1000, true, 301),
  ('top_critic', 'critic',
   '{"ko":"최우수 평론가","en":"Top Critic"}',
   '{"ko":"다른 회원에게 ''도움돼요'' 10개를 받은 후기를 쓰면 획득해요.","en":"Write a review that gets 10 helpful marks from other members."}',
   '[]', 500, false, 302),
  -- ── 온라인 · 아지트 ──
  ('conversation_starter', 'den',
   '{"ko":"분위기 메이커","en":"Conversation Starter"}',
   '{"ko":"댓글이 달린 아지트 글을 5개 쓰면 획득해요.","en":"Create 5 Den posts that get replies."}',
   '[]', 300, false, 401),
  ('influencer', 'den',
   '{"ko":"인플루언서","en":"Influencer"}',
   '{"ko":"아지트 글·댓글로 좋아요 50개를 모으면 획득해요.","en":"Collect 50 likes on your Den posts and comments."}',
   '[]', 500, false, 402),
  -- ── 온라인 · 홍보·추천 ──
  ('paparazzi', 'hustler',
   '{"ko":"파파라치","en":"Paparazzi"}',
   '{"ko":"페스티벌 영상을 인스타그램·틱톡에 올리고 123Band 계정을 태그하면, 운영진 확인 후 지급돼요.","en":"Post a festival video on Instagram or TikTok tagging 123Band — granted once our team checks it."}',
   '[{"type":"manual"}]', 200, true, 501),
  ('the_recruiter', 'hustler',
   '{"ko":"마당발","en":"The Recruiter"}',
   '{"ko":"내 추천 코드로 가입한 친구가 프로필을 완성하면 획득해요.","en":"Have a friend sign up with your referral code and complete their profile."}',
   '[{"type":"referral_signup_count","count":1}]', 300, true, 502),
  ('full_time_hustler', 'hustler',
   '{"ko":"프로 홍보러","en":"Full-Time Hustler"}',
   '{"ko":"내 추천으로 가입한 친구 5명이 페스티벌 패스를 구매하면 획득해요.","en":"Refer 5 friends who go on to buy a festival pass."}',
   '[{"type":"referral_purchase_count","count":5}]', 1500, true, 503),
  -- ── 온라인 · 여행 ──
  ('asia_circuit', 'explorer',
   '{"ko":"아시아 투어","en":"Asia Circuit"}',
   '{"ko":"서로 다른 3개 나라의 페스티벌 패스를 구매하면 획득해요.","en":"Buy passes for festivals in three different countries."}',
   '[{"type":"ticket_country_count","count":3}]', 500, true, 601),
  ('early_bird', 'explorer',
   '{"ko":"얼리버드","en":"Early Bird"}',
   '{"ko":"행사 시작 3개월(90일) 이상 전에 페스티벌 패스를 구매하면 획득해요.","en":"Buy a festival pass at least 3 months (90 days) before the event starts."}',
   '[{"type":"early_bird_purchase","count":1,"days":90}]', 300, true, 602),
  -- ── 온라인 · 충성 ──
  ('weekly_checkin', 'diehard',
   '{"ko":"출석부","en":"Weekly Check-in"}',
   '{"ko":"7일 연속으로 아지트에 접속하면 획득해요.","en":"Visit the Den 7 days in a row."}',
   '[]', 50, false, 701),
  ('eagle_eye', 'diehard',
   '{"ko":"매의 눈","en":"Eagle Eye"}',
   '{"ko":"사이트 오류·오타·깨진 링크를 가장 먼저 제보하면, 운영진 확인 후 지급돼요.","en":"Be the first to report a bug, typo or broken link — granted once our team confirms it."}',
   '[{"type":"manual"}]', 100, true, 702),
  -- ── 오프라인 · 현장 운영 ──
  ('first_contact', 'logistics',
   '{"ko":"첫 만남","en":"First Contact"}',
   '{"ko":"행사장 접수처에서 패스를 받고 입장 확인(QR)을 마치면 획득해요.","en":"Check in with your pass QR at the registration desk."}',
   '[{"type":"ticket_checkin_count","count":1}]', 0, true, 801),
  ('the_final_word', 'logistics',
   '{"ko":"마지막 한마디","en":"The Final Word"}',
   '{"ko":"행사가 끝난 뒤 로그인한 상태로 피드백 설문에 참여하면 획득해요.","en":"Complete the post-festival feedback survey while signed in."}',
   '[{"type":"feedback_submitted","count":1}]', 0, true, 802),
  ('oasis', 'logistics',
   '{"ko":"오아시스","en":"Oasis"}',
   '{"ko":"123Band 부스에서 포인트로 생수를 교환하면 획득해요.","en":"Redeem 123Band points for a bottle of water at our booth."}',
   '[]', 0, false, 803),
  ('breakfast_club', 'logistics',
   '{"ko":"브렉퍼스트 클럽","en":"The Breakfast Club"}',
   '{"ko":"공식 호텔 조식 뷔페에서 코드를 스캔하면 획득해요.","en":"Scan the code at the official hotel''s breakfast buffet."}',
   '[]', 0, false, 804),
  -- ── 오프라인 · 소셜 파티 ──
  ('icebreaker', 'party',
   '{"ko":"아이스브레이커","en":"Icebreaker"}',
   '{"ko":"저녁 소셜이 시작하고 1시간 안에 입장하면 획득해요.","en":"Arrive at the evening social within the first hour."}',
   '[]', 0, false, 901),
  ('sunrise_survivor', 'party',
   '{"ko":"새벽 생존자","en":"Sunrise Survivor"}',
   '{"ko":"새벽 3시 이후 메인 소셜룸에서 체크인하면 획득해요.","en":"Check in at the main social room after 3:00 AM."}',
   '[]', 0, false, 902),
  ('splash_zone', 'party',
   '{"ko":"스플래시 존","en":"Splash Zone"}',
   '{"ko":"공식 오후 풀·비치 파티에서 체크인하면 획득해요.","en":"Check in at the official afternoon pool or beach party."}',
   '[]', 0, false, 903),
  ('the_chameleon', 'party',
   '{"ko":"카멜레온","en":"The Chameleon"}',
   '{"ko":"테마 나이트 드레스코드를 입고 스캔하면 획득해요.","en":"Get scanned wearing the theme-night outfit."}',
   '[]', 0, false, 904),
  -- ── 오프라인 · 워크숍 ──
  ('workshop_warrior', 'grind',
   '{"ko":"워크숍 전사","en":"Workshop Warrior"}',
   '{"ko":"낮 워크숍에 3회 이상 체크인하면 획득해요.","en":"Check in to three or more daytime workshops."}',
   '[]', 0, false, 1001),
  ('bootcamp_veteran', 'grind',
   '{"ko":"부트캠프 베테랑","en":"Bootcamp Veteran"}',
   '{"ko":"특별 트레이닝이나 몇 시간짜리 인텐시브를 마치면 획득해요.","en":"Complete a special training session or multi-hour intensive."}',
   '[]', 0, false, 1002),
  -- ── 오프라인 · 대회·커뮤니티 ── (The Contender = 기존 audience_judge, 아래 6)에서 정리)
  ('the_ambassador', 'arena',
   '{"ko":"홍보대사","en":"The Ambassador"}',
   '{"ko":"행사 기간에 내 추천 QR로 새 회원이 가입하면 획득해요.","en":"Get a new member to sign up with your referral QR during the festival."}',
   '[]', 0, false, 1102),
  ('the_tracker', 'arena',
   '{"ko":"추적자","en":"The Tracker"}',
   '{"ko":"행사장 어딘가에 숨겨진 QR 코드를 찾아 스캔하면 획득해요.","en":"Find and scan a hidden QR code somewhere at the venue."}',
   '[]', 0, false, 1103)
on conflict (code) do nothing;

-- 6) 기존 업적 정리 -------------------------------------------------------------
-- 뉴스레터 구독 — 기획서에는 없지만 운영 중인 뱃지(보유자 있음). '시작하기' 맨 앞에 둔다.
update achievements set track = 'onboarding', sort_order = 101
 where code = 'newsletter_subscribe' and track is null;

-- 관객심사위원 = 기획서의 'The Contender'(J&J 현장에서 코드를 스캔해 참가).
--   조건이 비어 있어 아무에게도 지급되지 않았고, 영문 이름 칸에 한글이 들어 있었다.
update achievements
   set track = 'arena',
       sort_order = 1101,
       conditions = case
         when coalesce(jsonb_array_length(conditions), 0) = 0
           then '[{"type":"audience_judge_count","count":1}]'::jsonb
         else conditions
       end,
       name_i18n = case
         when coalesce(name_i18n->>'en', '') in ('', '관객심사위원')
           then jsonb_set(coalesce(name_i18n, '{}'::jsonb), '{en}', '"Audience Judge"')
         else name_i18n
       end,
       description_i18n = case
         when btrim(coalesce(description_i18n->>'ko', '')) = ''
           then '{"ko":"J&J 대회 현장에서 코드를 스캔해 관객 심사위원으로 참여하면 획득해요.","en":"Join a Jack & Jill competition as an audience judge by scanning the code at the venue."}'::jsonb
         else description_i18n
       end
 where code = 'audience_judge';
