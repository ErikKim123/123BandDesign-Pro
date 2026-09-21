-- 0043: 소셜 프로필 — 캐릭터(아바타) / 내 QR 코드 / 소셜 하트 / 친구 추천
-- 구성:
--   profiles.avatar_seed      : 캐릭터(아바타) 시드. 이 값으로 클라이언트가 SVG 캐릭터를 결정론적으로 그린다.
--   profiles.social_code      : 내 QR 에 실리는 8자리 공개 코드(혼동문자 제외). 추천/하트 공용 식별자.
--   profiles.referred_by      : 나를 추천한 회원(친구 추천 QR). 1회만 기록(되돌릴 수 없음).
--   profiles.social_blocked_at: 어드민이 소셜 기능(하트 주고받기)을 정지시킨 시각. null 이면 정상.
--   social_hearts             : 소셜 댄스 후 주고받는 "고마움" 하트. 같은 상대에겐 하루 1번(KST 기준).
-- 보안 철학(0037 포인트 / 0040 업적과 동일):
--   집계 대상 테이블은 조회 정책만 두고, 쓰기는 SECURITY DEFINER 함수로만 허용한다.
--   social_code / referred_by / social_blocked_at 은 본인이 직접 UPDATE 하지 못하도록 트리거로 고정한다.
--   (profiles_self 정책이 본인 행 전체 UPDATE 를 허용하기 때문에 컬럼 단위 방어가 필요하다.)
-- idempotent.

-- 1) profiles 확장 ------------------------------------------------------------
alter table band123.profiles
  add column if not exists avatar_seed text,
  add column if not exists social_code text,
  add column if not exists referred_by uuid references band123.profiles(id) on delete set null,
  add column if not exists referred_at timestamptz,
  add column if not exists social_blocked_at timestamptz;

-- 공개 코드 생성기 — 혼동하기 쉬운 0/1/I/O 를 뺀 32자 알파벳으로 8자리.
-- security definer: 컬럼 DEFAULT 로 호출되면 실행 주체가 가입자라 RLS 때문에 중복 검사를
--                   못 하게 된다. 정의자 권한으로 전체 행을 보고 충돌을 피한다.
create or replace function band123.gen_social_code()
returns text
language plpgsql
volatile
security definer
set search_path = band123
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  i int;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from band123.profiles where social_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- DEFAULT 로 걸어두면 가입 트리거/콜백/AuthForm 등 어느 경로로 profiles 가 생겨도 자동 채워진다.
alter table band123.profiles alter column social_code set default band123.gen_social_code();
alter table band123.profiles alter column avatar_seed set default encode(gen_random_bytes(8), 'hex');

-- 기존 회원 백필(비어 있는 행만) — volatile 함수라 행마다 새 값이 나온다.
update band123.profiles set social_code = band123.gen_social_code() where social_code is null;
update band123.profiles set avatar_seed = encode(gen_random_bytes(8), 'hex') where avatar_seed is null;

create unique index if not exists uq_profiles_social_code on band123.profiles (social_code);
create index if not exists idx_profiles_referred_by on band123.profiles (referred_by);

-- 2) 민감 컬럼 고정 트리거 ----------------------------------------------------
-- profiles_self 는 본인 행의 전체 UPDATE 를 허용한다. 그대로 두면 회원이 자기 social_code 를
-- 바꾸거나(코드 선점), referred_by 를 갈아끼우거나, 어드민이 건 소셜 정지를 스스로 풀 수 있다.
-- 어드민이 아닌 주체의 변경은 조용히 이전 값으로 되돌린다.
create or replace function band123.profiles_social_guard()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  if band123.is_admin() then
    return new;
  end if;
  -- 공개 코드는 발급 후 불변
  if new.social_code is distinct from old.social_code then
    new.social_code := old.social_code;
  end if;
  -- 추천인은 null → 값 방향으로 1회만. 이미 값이 있으면 고정.
  if old.referred_by is not null and new.referred_by is distinct from old.referred_by then
    new.referred_by := old.referred_by;
    new.referred_at := old.referred_at;
  end if;
  -- 소셜 정지 해제는 어드민만
  if new.social_blocked_at is distinct from old.social_blocked_at then
    new.social_blocked_at := old.social_blocked_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_social_guard on band123.profiles;
create trigger trg_profiles_social_guard
  before update on band123.profiles
  for each row execute function band123.profiles_social_guard();

-- 3) 소셜 하트 ----------------------------------------------------------------
-- created_date: 하루 1회 제한의 기준. 행사가 열리는 KST 자정을 경계로 삼는다.
create table if not exists band123.social_hearts (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references band123.profiles(id) on delete cascade,
  to_user_id   uuid not null references band123.profiles(id) on delete cascade,
  message text,
  created_at timestamptz not null default now(),
  created_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  constraint social_hearts_no_self check (from_user_id <> to_user_id)
);

create unique index if not exists uq_social_hearts_daily
  on band123.social_hearts (from_user_id, to_user_id, created_date);
create index if not exists idx_social_hearts_to on band123.social_hearts (to_user_id, created_at desc);
create index if not exists idx_social_hearts_from on band123.social_hearts (from_user_id, created_at desc);

alter table band123.social_hearts enable row level security;

-- 조회는 당사자(준 사람/받은 사람)와 어드민만. 쓰기는 give_social_heart() 로만.
drop policy if exists social_hearts_select_own on band123.social_hearts;
create policy social_hearts_select_own on band123.social_hearts
  for select using (
    from_user_id = auth.uid() or to_user_id = auth.uid() or band123.is_admin()
  );

-- 어드민은 부적절한 하트를 삭제할 수 있어야 한다(신고 대응).
drop policy if exists social_hearts_admin_write on band123.social_hearts;
create policy social_hearts_admin_write on band123.social_hearts
  for all using (band123.is_admin()) with check (band123.is_admin());

-- 4) 코드로 소셜 프로필 조회 --------------------------------------------------
-- QR 을 찍은 사람에게 보여줄 최소 정보. 로그인 전에도(anon) 열 수 있어야 가입 유도가 된다.
-- 이메일은 절대 노출하지 않는다 — 이름이 비어 있으면 코드로 대체한다.
create or replace function band123.social_profile_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_row record;
  v_me uuid := auth.uid();
  v_hearts int;
  v_referrals int;
  v_sent_today boolean := false;
begin
  select id, name, avatar_seed, social_code, social_blocked_at, role
    into v_row
  from band123.profiles
  where social_code = upper(btrim(coalesce(p_code, '')))
  limit 1;

  if not found then
    return null;
  end if;
  -- 고객 계정만 소셜 프로필을 가진다(어드민/오거나이저 계정은 노출하지 않음)
  if v_row.role <> 'customer' then
    return null;
  end if;

  select count(*) into v_hearts from band123.social_hearts where to_user_id = v_row.id;
  select count(*) into v_referrals from band123.profiles where referred_by = v_row.id;

  if v_me is not null then
    select exists (
      select 1 from band123.social_hearts
      where from_user_id = v_me
        and to_user_id = v_row.id
        and created_date = ((now() at time zone 'Asia/Seoul')::date)
    ) into v_sent_today;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'name', coalesce(nullif(btrim(coalesce(v_row.name, '')), ''), v_row.social_code),
    'avatar_seed', v_row.avatar_seed,
    'social_code', v_row.social_code,
    'hearts_received', v_hearts,
    'referral_count', v_referrals,
    'blocked', v_row.social_blocked_at is not null,
    'is_me', v_me is not distinct from v_row.id,
    'sent_today', v_sent_today
  );
end;
$$;

grant execute on function band123.social_profile_by_code(text) to anon, authenticated;

-- 5) 하트 주기 ----------------------------------------------------------------
-- QR 로 얻은 상대 코드로만 호출된다. 같은 상대에겐 KST 하루 1회.
create or replace function band123.give_social_heart(p_code text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_target uuid;
  v_target_blocked timestamptz;
  v_me_blocked timestamptz;
  v_total int;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select id, social_blocked_at into v_target, v_target_blocked
  from band123.profiles
  where social_code = upper(btrim(coalesce(p_code, ''))) and role = 'customer'
  limit 1;

  if v_target is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_target = v_me then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;
  if v_target_blocked is not null then
    return jsonb_build_object('ok', false, 'error', 'blocked');
  end if;

  select social_blocked_at into v_me_blocked from band123.profiles where id = v_me;
  if v_me_blocked is not null then
    return jsonb_build_object('ok', false, 'error', 'blocked_me');
  end if;

  insert into band123.social_hearts (from_user_id, to_user_id, message)
  values (v_me, v_target, nullif(btrim(coalesce(p_message, '')), ''))
  on conflict (from_user_id, to_user_id, created_date) do nothing;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_today');
  end if;

  select count(*) into v_total from band123.social_hearts where to_user_id = v_target;
  return jsonb_build_object('ok', true, 'hearts_received', v_total);
end;
$$;

grant execute on function band123.give_social_heart(text, text) to authenticated;

-- 6) 친구 추천 기록 -----------------------------------------------------------
-- 추천 QR(= 가입 링크)로 들어온 신규 회원이 로그인 직후 1회 호출한다.
-- 가입 7일 이내 + 아직 추천인이 없을 때만 기록된다(뒤늦은 소급 지정 방지).
create or replace function band123.apply_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_existing uuid;
  v_created timestamptz;
  v_ref uuid;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select referred_by, created_at into v_existing, v_created
  from band123.profiles where id = v_me;

  if v_existing is not null then
    return jsonb_build_object('ok', false, 'error', 'already');
  end if;
  if v_created is null or v_created < now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  select id into v_ref
  from band123.profiles
  where social_code = upper(btrim(coalesce(p_code, ''))) and role = 'customer'
  limit 1;

  if v_ref is null or v_ref = v_me then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  update band123.profiles
  set referred_by = v_ref, referred_at = now()
  where id = v_me and referred_by is null;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function band123.apply_referral(text) to authenticated;

-- 7) 내 소셜 요약 -------------------------------------------------------------
create or replace function band123.my_social_summary()
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_row record;
  v_recv int;
  v_given int;
  v_refs int;
begin
  if v_me is null then
    return null;
  end if;

  select social_code, avatar_seed, social_blocked_at into v_row
  from band123.profiles where id = v_me;

  if not found then
    return null;
  end if;

  select count(*) into v_recv  from band123.social_hearts where to_user_id = v_me;
  select count(*) into v_given from band123.social_hearts where from_user_id = v_me;
  select count(*) into v_refs  from band123.profiles where referred_by = v_me;

  return jsonb_build_object(
    'social_code', v_row.social_code,
    'avatar_seed', v_row.avatar_seed,
    'blocked', v_row.social_blocked_at is not null,
    'hearts_received', v_recv,
    'hearts_given', v_given,
    'referral_count', v_refs
  );
end;
$$;

grant execute on function band123.my_social_summary() to authenticated;

-- 7-1) 내 하트 목록 -----------------------------------------------------------
-- social_hearts 는 RLS 로 본인 것만 보이지만, "상대가 누구인지"(이름/캐릭터)는 profiles_self
-- 정책 때문에 임베드 조인으로 가져올 수 없다(남의 profiles 행은 안 보임).
-- 그래서 상대 정보까지 묶어 돌려주는 전용 함수를 둔다. 노출 항목은 QR 프로필과 동일 수준.
create or replace function band123.my_hearts(p_direction text default 'received', p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_out jsonb;
begin
  if v_me is null then
    return '[]'::jsonb;
  end if;

  if p_direction = 'given' then
    select coalesce(jsonb_agg(x order by ord desc), '[]'::jsonb) into v_out from (
      select h.created_at as ord,
             jsonb_build_object(
               'id', h.id,
               'name', coalesce(nullif(btrim(coalesce(p.name, '')), ''), p.social_code),
               'avatar_seed', p.avatar_seed,
               'social_code', p.social_code,
               'message', h.message,
               'created_at', h.created_at
             ) as x
      from band123.social_hearts h
      join band123.profiles p on p.id = h.to_user_id
      where h.from_user_id = v_me
      order by h.created_at desc
      limit v_limit
    ) s;
  else
    select coalesce(jsonb_agg(x order by ord desc), '[]'::jsonb) into v_out from (
      select h.created_at as ord,
             jsonb_build_object(
               'id', h.id,
               'name', coalesce(nullif(btrim(coalesce(p.name, '')), ''), p.social_code),
               'avatar_seed', p.avatar_seed,
               'social_code', p.social_code,
               'message', h.message,
               'created_at', h.created_at
             ) as x
      from band123.social_hearts h
      join band123.profiles p on p.id = h.from_user_id
      where h.to_user_id = v_me
      order by h.created_at desc
      limit v_limit
    ) s;
  end if;

  return v_out;
end;
$$;

grant execute on function band123.my_hearts(text, int) to authenticated;

-- 7-2) 내 추천 현황 -----------------------------------------------------------
create or replace function band123.my_referrals()
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_by jsonb;
  v_list jsonb;
begin
  if v_me is null then
    return null;
  end if;

  select jsonb_build_object(
           'name', coalesce(nullif(btrim(coalesce(r.name, '')), ''), r.social_code),
           'avatar_seed', r.avatar_seed,
           'social_code', r.social_code
         )
    into v_by
  from band123.profiles me
  join band123.profiles r on r.id = me.referred_by
  where me.id = v_me;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'name', coalesce(nullif(btrim(coalesce(p.name, '')), ''), p.social_code),
             'avatar_seed', p.avatar_seed,
             'social_code', p.social_code,
             'referred_at', p.referred_at
           ) order by p.referred_at desc nulls last
         ), '[]'::jsonb)
    into v_list
  from band123.profiles p
  where p.referred_by = v_me;

  return jsonb_build_object('referred_by', v_by, 'referrals', v_list);
end;
$$;

grant execute on function band123.my_referrals() to authenticated;

-- 8) 캐릭터 다시 뽑기 ---------------------------------------------------------
-- 마이페이지에서 "캐릭터 바꾸기". 시드만 새로 발급하면 렌더 결과가 통째로 바뀐다.
create or replace function band123.reroll_avatar()
returns text
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_seed text;
begin
  if v_me is null then
    return null;
  end if;
  v_seed := encode(gen_random_bytes(8), 'hex');
  update band123.profiles set avatar_seed = v_seed where id = v_me;
  return v_seed;
end;
$$;

grant execute on function band123.reroll_avatar() to authenticated;

-- 8-1) 어드민 목록용 뷰 -------------------------------------------------------
-- 어드민 목록(ResourceListPage)은 postgrest 로 테이블을 직접 읽는다. 하트/추천 모두
-- "상대가 누구인지"를 함께 보여줘야 하는데 임베드 조인은 컬럼별 검색이 안 되므로
-- 평평한 뷰로 펼친다. security_invoker=on 이라 RLS 는 호출자 기준으로 그대로 적용된다
-- (어드민은 전체, 일반 회원은 자기 것만 — 뷰가 권한 우회 통로가 되지 않는다).
drop view if exists band123.social_hearts_v;
create view band123.social_hearts_v
with (security_invoker = on) as
select
  h.id,
  h.created_at,
  h.created_date,
  h.message,
  h.from_user_id,
  h.to_user_id,
  f.name  as from_name,
  f.email as from_email,
  f.social_code as from_code,
  t.name  as to_name,
  t.email as to_email,
  t.social_code as to_code
from band123.social_hearts h
join band123.profiles f on f.id = h.from_user_id
join band123.profiles t on t.id = h.to_user_id;

grant select on band123.social_hearts_v to authenticated;

drop view if exists band123.social_referrals_v;
create view band123.social_referrals_v
with (security_invoker = on) as
select
  p.id,
  p.name,
  p.email,
  p.social_code,
  p.country,
  p.created_at,
  p.referred_at,
  p.referred_by,
  r.name  as referrer_name,
  r.email as referrer_email,
  r.social_code as referrer_code
from band123.profiles p
join band123.profiles r on r.id = p.referred_by;

grant select on band123.social_referrals_v to authenticated;

-- 9) 어드민 — 소셜 정지 토글 / 통계 -------------------------------------------
create or replace function band123.admin_set_social_block(p_user_id uuid, p_blocked boolean)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
begin
  if not band123.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update band123.profiles
  set social_blocked_at = case when p_blocked then now() else null end
  where id = p_user_id;
  return jsonb_build_object('ok', true, 'blocked', p_blocked);
end;
$$;

grant execute on function band123.admin_set_social_block(uuid, boolean) to authenticated;

-- 하트/추천 현황 요약 + 상위 랭킹. 어드민 대시보드 카드용.
create or replace function band123.admin_social_stats(p_limit int default 10)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_total int;
  v_today_cnt int;
  v_week int;
  v_participants int;
  v_referrals int;
  v_blocked int;
  v_top_recv jsonb;
  v_top_give jsonb;
  v_top_ref jsonb;
begin
  if not band123.is_admin() then
    return null;
  end if;

  select count(*) into v_total from band123.social_hearts;
  select count(*) into v_today_cnt from band123.social_hearts where created_date = v_today;
  select count(*) into v_week from band123.social_hearts where created_date > v_today - 7;
  select count(*) into v_referrals from band123.profiles where referred_by is not null;
  select count(*) into v_blocked from band123.profiles where social_blocked_at is not null;

  -- 하트를 주거나 받은 적 있는 고유 회원 수
  select count(*) into v_participants from (
    select from_user_id as uid from band123.social_hearts
    union
    select to_user_id from band123.social_hearts
  ) t;

  -- 서브쿼리의 ORDER BY 는 상위 집계까지 보장되지 않으므로, 정렬 키(cnt)를 함께 올려
  -- jsonb_agg 안에서 다시 정렬한다(순위가 뒤섞이지 않게).
  select coalesce(jsonb_agg(x order by cnt desc), '[]'::jsonb) into v_top_recv from (
    select count(*) as cnt,
           jsonb_build_object(
             'user_id', h.to_user_id,
             'name', coalesce(nullif(p.name, ''), p.email, '—'),
             'count', count(*)
           ) as x
    from band123.social_hearts h
    join band123.profiles p on p.id = h.to_user_id
    group by h.to_user_id, p.name, p.email
    order by count(*) desc
    limit greatest(coalesce(p_limit, 10), 1)
  ) s;

  select coalesce(jsonb_agg(x order by cnt desc), '[]'::jsonb) into v_top_give from (
    select count(*) as cnt,
           jsonb_build_object(
             'user_id', h.from_user_id,
             'name', coalesce(nullif(p.name, ''), p.email, '—'),
             'count', count(*)
           ) as x
    from band123.social_hearts h
    join band123.profiles p on p.id = h.from_user_id
    group by h.from_user_id, p.name, p.email
    order by count(*) desc
    limit greatest(coalesce(p_limit, 10), 1)
  ) s;

  select coalesce(jsonb_agg(x order by cnt desc), '[]'::jsonb) into v_top_ref from (
    select count(*) as cnt,
           jsonb_build_object(
             'user_id', p.referred_by,
             'name', coalesce(nullif(r.name, ''), r.email, '—'),
             'count', count(*)
           ) as x
    from band123.profiles p
    join band123.profiles r on r.id = p.referred_by
    where p.referred_by is not null
    group by p.referred_by, r.name, r.email
    order by count(*) desc
    limit greatest(coalesce(p_limit, 10), 1)
  ) s;

  return jsonb_build_object(
    'hearts_total', v_total,
    'hearts_today', v_today_cnt,
    'hearts_week', v_week,
    'participants', v_participants,
    'referrals_total', v_referrals,
    'blocked_members', v_blocked,
    'top_receivers', v_top_recv,
    'top_givers', v_top_give,
    'top_referrers', v_top_ref
  );
end;
$$;

grant execute on function band123.admin_social_stats(int) to authenticated;
