-- 0044: 소셜 프로필 보강 — 캐릭터 성별 선택 + 표시 이름 길이 제한
-- 배경: 0043 은 캐릭터를 시드만으로 결정했는데, 회원이 남성/여성 캐릭터를 직접 고를 수 있어야 한다.
--       또 마이페이지가 이름 대신 이메일(구글 계정 tombstone 포함)을 노출하고 있어
--       회원이 표시 이름을 직접 입력하는 흐름으로 바꾼다(이름은 다른 회원의 하트 목록에도 보인다).
-- avatar_style: null = 아직 고르지 않음 → 클라이언트가 시드에서 파생해 그린다(사람마다 다르게).
-- 이름/스타일 변경은 profiles_self 정책으로 본인이 직접 UPDATE 한다(별도 RPC 불필요).
--   0043 의 profiles_social_guard 트리거는 social_code/referred_by/social_blocked_at 만 고정하므로
--   name/avatar_style 수정은 그대로 통과한다.
-- idempotent.

-- 1) 캐릭터 성별 -------------------------------------------------------------
alter table band123.profiles
  add column if not exists avatar_style text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_style_check'
  ) then
    alter table band123.profiles
      add constraint profiles_avatar_style_check
      check (avatar_style is null or avatar_style in ('female', 'male'));
  end if;
end;
$$;

-- 2) 표시 이름 길이 제한 -------------------------------------------------------
-- 다른 회원 화면(하트 목록·QR 프로필)에 그대로 노출되므로 상한을 DB에서 강제한다.
-- 기존 행 중 초과분은 먼저 잘라내야 제약을 걸 수 있다(운영 데이터 보존).
update band123.profiles set name = left(name, 40) where char_length(name) > 40;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_name_len_check'
  ) then
    alter table band123.profiles
      add constraint profiles_name_len_check
      check (name is null or char_length(name) <= 40);
  end if;
end;
$$;

-- 3) 소셜 RPC 들이 avatar_style 을 함께 돌려주도록 갱신 ------------------------
-- (0043 정의에서 avatar_style 필드만 추가. 나머지 로직/보안 조건은 동일.)

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
  select id, name, avatar_seed, avatar_style, social_code, social_blocked_at, role
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
    'avatar_style', v_row.avatar_style,
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

  select name, social_code, avatar_seed, avatar_style, social_blocked_at into v_row
  from band123.profiles where id = v_me;

  if not found then
    return null;
  end if;

  select count(*) into v_recv  from band123.social_hearts where to_user_id = v_me;
  select count(*) into v_given from band123.social_hearts where from_user_id = v_me;
  select count(*) into v_refs  from band123.profiles where referred_by = v_me;

  return jsonb_build_object(
    'name', nullif(btrim(coalesce(v_row.name, '')), ''),
    'social_code', v_row.social_code,
    'avatar_seed', v_row.avatar_seed,
    'avatar_style', v_row.avatar_style,
    'blocked', v_row.social_blocked_at is not null,
    'hearts_received', v_recv,
    'hearts_given', v_given,
    'referral_count', v_refs
  );
end;
$$;

grant execute on function band123.my_social_summary() to authenticated;

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
               'avatar_style', p.avatar_style,
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
               'avatar_style', p.avatar_style,
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
           'avatar_style', r.avatar_style,
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
             'avatar_style', p.avatar_style,
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
