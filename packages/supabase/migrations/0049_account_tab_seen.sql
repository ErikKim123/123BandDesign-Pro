-- 0049_account_tab_seen.sql
-- 마이페이지 탭 배지를 "알림"으로 — 확인한 탭의 숫자는 사라진다.
--
-- 배경: 지금 탭 배지는 누적 개수(주문 6, 포인트 100, 뱃지 1 …)를 항상 달고 있다.
--       늘 켜져 있는 숫자는 알림이 아니라 장식이 되고, 정작 새로 생긴 게 있어도 눈에 안 띈다.
--       → 각 탭을 "마지막으로 본 시각"을 남기고, 그 이후에 생긴 것만 세서 배지로 띄운다.
--         탭에 들어가면 그 시각이 갱신되므로 숫자는 자연스럽게 사라진다.
--
-- 소셜 탭은 이미 0047 의 social_hearts.read_at(안읽음)으로 같은 동작을 한다 — 여기서는 건드리지 않는다.
-- 탭별 카운트 자체는 웹에서 RLS 로 직접 세므로(본인 행만 보임) 여기서는 "본 시각" 보관만 담당한다.

-- 탭 키 → 마지막 확인 시각. {"orders":"2026-08-05T...","points":"..."} 형태.
-- 컬럼을 탭마다 만들지 않는 이유: 탭이 늘고 줄 때마다 마이그레이션을 또 쳐야 한다.
alter table band123.profiles
  add column if not exists tab_seen_at jsonb not null default '{}'::jsonb;

-- 해당 탭을 지금 확인한 것으로 표시하고 그 시각을 돌려준다. 탭 진입 시 1회 호출.
-- 화이트리스트를 두는 이유: jsonb 키는 뭐든 들어가므로 오타/임의 키로 쓰레기가 쌓이는 걸 막는다.
create or replace function band123.mark_tab_seen(p_tab text)
returns timestamptz
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_me is null then
    return null;
  end if;
  if p_tab is null or p_tab not in ('orders', 'gifts', 'points', 'badges') then
    raise exception 'invalid_tab';
  end if;

  update band123.profiles
     set tab_seen_at = coalesce(tab_seen_at, '{}'::jsonb)
                       || jsonb_build_object(p_tab, to_jsonb(v_now))
   where id = v_me;

  return v_now;
end;
$$;

grant execute on function band123.mark_tab_seen(text) to authenticated;
