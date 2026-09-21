-- 0046: 소셜 반응 5종 확장 (하트 / 엄지척 / 댄스 / 불꽃 / 박수)
-- 0043~0044 의 "하트" 한 종류를 kind 로 확장한다. 테이블/함수 이름은 그대로 둔다
--   (social_hearts = 소셜 반응 원장. 이름만 하트일 뿐 종류는 kind 가 결정한다).
--
-- 하루 제한: 같은 상대에게 "종류별로" 하루 1번 (KST 자정 기준, created_date).
--   → 유니크 인덱스 기준을 (from, to, date) 에서 (from, to, date, kind) 로 바꾼다.
-- 기존 행은 default 'heart' 로 남아 그대로 유효하다.

-- 1) kind 컬럼 -----------------------------------------------------------------
alter table band123.social_hearts
  add column if not exists kind text not null default 'heart';

alter table band123.social_hearts drop constraint if exists social_hearts_kind_chk;
alter table band123.social_hearts
  add constraint social_hearts_kind_chk
  check (kind in ('heart', 'thumbs', 'dance', 'fire', 'clap'));

-- 2) 하루 1회 기준을 종류별로 -------------------------------------------------
drop index if exists band123.uq_social_hearts_daily;
create unique index if not exists uq_social_hearts_daily_kind
  on band123.social_hearts (from_user_id, to_user_id, created_date, kind);

-- 3) 코드로 소셜 프로필 조회 --------------------------------------------------
-- (0044 정의에서 sent_kinds 만 추가. sent_today 는 "오늘 아무 반응이나 보냈는지"로 유지.)
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
  v_sent_kinds jsonb := '[]'::jsonb;
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

  -- 오늘 이 상대에게 이미 보낸 종류 — 버튼을 개별로 비활성화하는 데 쓴다.
  if v_me is not null then
    select coalesce(jsonb_agg(distinct h.kind), '[]'::jsonb) into v_sent_kinds
    from band123.social_hearts h
    where h.from_user_id = v_me
      and h.to_user_id = v_row.id
      and h.created_date = ((now() at time zone 'Asia/Seoul')::date);
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
    'sent_kinds', v_sent_kinds,
    'sent_today', jsonb_array_length(v_sent_kinds) > 0
  );
end;
$$;

grant execute on function band123.social_profile_by_code(text) to anon, authenticated;

-- 4) 반응 보내기 ---------------------------------------------------------------
-- 시그니처가 바뀌므로(p_kind 추가) 2인자 버전은 제거한다 — 남겨두면 PostgREST 가
-- 이름 기반 오버로드 해석에서 모호해진다.
drop function if exists band123.give_social_heart(text, text);

create or replace function band123.give_social_heart(
  p_code text,
  p_message text default null,
  p_kind text default 'heart'
)
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
  v_kind text := lower(btrim(coalesce(p_kind, 'heart')));
  v_total int;
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if v_kind not in ('heart', 'thumbs', 'dance', 'fire', 'clap') then
    return jsonb_build_object('ok', false, 'error', 'bad_kind');
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

  insert into band123.social_hearts (from_user_id, to_user_id, message, kind)
  values (v_me, v_target, nullif(btrim(coalesce(p_message, '')), ''), v_kind)
  on conflict (from_user_id, to_user_id, created_date, kind) do nothing;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_today', 'kind', v_kind);
  end if;

  select count(*) into v_total from band123.social_hearts where to_user_id = v_target;
  return jsonb_build_object('ok', true, 'kind', v_kind, 'hearts_received', v_total);
end;
$$;

grant execute on function band123.give_social_heart(text, text, text) to authenticated;

-- 5) 내 반응 목록 --------------------------------------------------------------
-- (0044 정의에서 kind 만 추가.)
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
               'kind', h.kind,
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
               'kind', h.kind,
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

-- 6) 어드민 목록 뷰에도 종류 노출 ---------------------------------------------
drop view if exists band123.social_hearts_v;
create view band123.social_hearts_v
with (security_invoker = on) as
select
  h.id,
  h.created_at,
  h.created_date,
  h.kind,
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
