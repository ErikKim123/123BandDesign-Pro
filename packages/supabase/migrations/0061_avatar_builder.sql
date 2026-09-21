-- 0061_avatar_builder.sql
-- 아바타를 '프리셋 고르기'에서 '항목별로 조립하기'로 바꾼다.
--
-- 배경: 기존에는 avatar_style(여성/남성/강아지/고양이) 프리셋을 고르고 '다시 뽑기'로
--   나머지를 통째로 굴리는 방식이었다. 머리모양 하나만 바꾸고 싶어도 방법이 없었고,
--   경우의 수가 수백만이라 원하는 조합을 뽑기로 맞추는 건 사실상 불가능했다.
--
-- avatar_traits: 회원이 편집기에서 '고른 항목만' 인덱스로 담는다(예: {"pose":2,"hair":5}).
--   비어 있는 항목은 예전처럼 avatar_seed 에서 파생된다 → 기존 회원 캐릭터가 유지되고,
--   팔레트를 나중에 늘려도 저장값이 깨지지 않는다.
--
-- avatar_style 컬럼과 아래 RPC 의 avatar_style 필드는 남겨둔다 — 렌더링에는 더 쓰지 않지만
--   지우면 소셜 RPC 4종의 응답 계약이 깨진다. 실제 제거는 별도 정리 작업으로 미룬다.

alter table band123.profiles add column if not exists avatar_traits jsonb;

-- 아래 정의는 운영 DB 의 현재 함수 정의를 그대로 가져와(pg_get_functiondef)
-- avatar_traits 필드만 끼워넣은 것이다. 로직·보안 조건은 손대지 않았다.

CREATE OR REPLACE FUNCTION band123.my_hearts(p_direction text DEFAULT 'received'::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'band123'
AS $function$
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
               'avatar_style', p.avatar_style, 'avatar_traits', p.avatar_traits,
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
               'avatar_style', p.avatar_style, 'avatar_traits', p.avatar_traits,
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
$function$;

CREATE OR REPLACE FUNCTION band123.my_referrals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'band123'
AS $function$
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
           'avatar_style', r.avatar_style, 'avatar_traits', r.avatar_traits,
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
             'avatar_style', p.avatar_style, 'avatar_traits', p.avatar_traits,
             'social_code', p.social_code,
             'referred_at', p.referred_at
           ) order by p.referred_at desc nulls last
         ), '[]'::jsonb)
    into v_list
  from band123.profiles p
  where p.referred_by = v_me;

  return jsonb_build_object('referred_by', v_by, 'referrals', v_list);
end;
$function$;

CREATE OR REPLACE FUNCTION band123.my_social_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'band123'
AS $function$
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

  select name, social_code, avatar_seed, avatar_style, avatar_traits, social_blocked_at into v_row
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
    'avatar_style', v_row.avatar_style, 'avatar_traits', v_row.avatar_traits,
    'blocked', v_row.social_blocked_at is not null,
    'hearts_received', v_recv,
    'hearts_given', v_given,
    'referral_count', v_refs
  );
end;
$function$;

CREATE OR REPLACE FUNCTION band123.social_profile_by_code(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'band123'
AS $function$
declare
  v_row record;
  v_me uuid := auth.uid();
  v_hearts int;
  v_referrals int;
  v_sent_kinds jsonb := '[]'::jsonb;
begin
  select id, name, avatar_seed, avatar_style, avatar_traits, social_code, social_blocked_at, role
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
    'avatar_style', v_row.avatar_style, 'avatar_traits', v_row.avatar_traits,
    'social_code', v_row.social_code,
    'hearts_received', v_hearts,
    'referral_count', v_referrals,
    'blocked', v_row.social_blocked_at is not null,
    'is_me', v_me is not distinct from v_row.id,
    'sent_kinds', v_sent_kinds,
    'sent_today', jsonb_array_length(v_sent_kinds) > 0
  );
end;
$function$;
