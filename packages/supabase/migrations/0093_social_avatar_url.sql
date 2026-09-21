-- Design Ref: 회원 프로필 사진(0092) — 소셜 RPC 가 avatar_url 도 함께 내려주도록.
--
-- 하트 목록·추천인·QR 프로필은 profiles 를 직접 읽지 않고 이 함수들이 만들어 준 JSON 을 받는다.
-- 0092 에서 컬럼만 추가하면 편집 화면에만 사진이 보이고 남이 보는 자리에는 계속 캐릭터가 뜬다.
--
-- 아래 정의는 손으로 옮겨 적은 것이 아니라, 배포돼 있던 정의를 읽어
-- 'avatar_traits' 옆에 'avatar_url' 한 쌍만 끼워 넣어 생성한 것이다
-- (packages/supabase/gen_0093_social_avatar_url.mjs). 그 외에는 한 글자도 바뀌지 않았다.
--
-- idempotent: create or replace function.

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
               'avatar_style', p.avatar_style, 'avatar_traits', p.avatar_traits, 'avatar_url', p.avatar_url,
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
               'avatar_style', p.avatar_style, 'avatar_traits', p.avatar_traits, 'avatar_url', p.avatar_url,
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
           'avatar_style', r.avatar_style, 'avatar_traits', r.avatar_traits, 'avatar_url', r.avatar_url,
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
             'avatar_style', p.avatar_style, 'avatar_traits', p.avatar_traits, 'avatar_url', p.avatar_url,
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

  select name, social_code, avatar_seed, avatar_style, avatar_traits, avatar_url, social_blocked_at into v_row
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
    'avatar_style', v_row.avatar_style, 'avatar_traits', v_row.avatar_traits, 'avatar_url', v_row.avatar_url,
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
  select id, name, avatar_seed, avatar_style, avatar_traits, avatar_url, social_code, social_blocked_at, role
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
    'avatar_style', v_row.avatar_style, 'avatar_traits', v_row.avatar_traits, 'avatar_url', v_row.avatar_url,
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
