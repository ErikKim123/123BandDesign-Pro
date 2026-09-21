-- 0051: 소셜 반응 하루 제한을 "친구당 1개" 로 축소
--
-- 0046 은 하루 제한을 "같은 상대에게 종류별로 1번" 으로 뒀다. 반응이 5종류라
-- 한 친구에게 하루 최대 5개까지 갈 수 있었고, 실제로 같은 사람에게 하루 3개가
-- 쌓였다. 의도한 건 "고마움을 하루 한 번 전한다" 였으므로 종류와 무관하게
-- (보낸이, 받는이, 날짜) 단위로 1번만 허용한다.
--   → 유니크 인덱스 기준을 (from, to, date, kind) 에서 (from, to, date) 로 되돌린다.
--     kind 컬럼은 그대로 둔다 — 어떤 반응을 보냈는지는 계속 기록/표시한다.
--
-- ⚠️ 기존 데이터에 같은 (from, to, date) 조합이 여러 건 있다(종류만 다름).
--    유니크 인덱스를 걸기 전에 각 조합의 '가장 먼저 보낸 1건' 만 남기고 지운다.
--    삭제되는 행은 소셜 반응 기록뿐이다(다른 테이블에서 참조하지 않는다).
-- ⚠️ 웹 배포와 순서를 맞출 것: 마이그레이션 먼저 → 웹 배포.
--    먼저 배포하면 구버전 UI 가 두 번째 반응을 보낼 수 있는 것처럼 보이고 서버에서 거절된다.
-- idempotent.

-- 1) 중복 정리 — (보낸이, 받는이, 날짜) 당 가장 이른 1건만 남긴다 -----------------
delete from band123.social_hearts h
using band123.social_hearts k
where h.from_user_id = k.from_user_id
  and h.to_user_id   = k.to_user_id
  and h.created_date = k.created_date
  and (k.created_at, k.id) < (h.created_at, h.id);

-- 2) 유니크 기준을 종류 무관으로 ------------------------------------------------
drop index if exists band123.uq_social_hearts_daily_kind;
create unique index if not exists uq_social_hearts_daily
  on band123.social_hearts (from_user_id, to_user_id, created_date);

-- 3) 반응 보내기 — 충돌 판정 컬럼을 3개로 --------------------------------------
-- (0046 정의에서 on conflict 대상만 바뀐다. 시그니처는 그대로라 웹 호출부는 변경 없음.)
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

  -- 종류와 무관하게 하루 1번 (KST 자정 기준 created_date)
  insert into band123.social_hearts (from_user_id, to_user_id, message, kind)
  values (v_me, v_target, nullif(btrim(coalesce(p_message, '')), ''), v_kind)
  on conflict (from_user_id, to_user_id, created_date) do nothing;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_today', 'kind', v_kind);
  end if;

  select count(*) into v_total from band123.social_hearts where to_user_id = v_target;
  return jsonb_build_object('ok', true, 'kind', v_kind, 'hearts_received', v_total);
end;
$$;

grant execute on function band123.give_social_heart(text, text, text) to authenticated;

-- 4) social_profile_by_code 는 그대로 둔다 --------------------------------------
-- sent_kinds 는 이제 최대 1개만 담긴다(오늘 보낸 그 종류). 웹은 "비어 있지 않으면
-- 전부 잠금" 으로 읽는다. sent_today 의 의미는 이전과 같다.
