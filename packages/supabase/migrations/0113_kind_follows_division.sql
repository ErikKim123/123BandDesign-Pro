-- 0113: 종류(kind)는 부문을 따라간다 — 넣는 경로가 무엇이든
--
-- 0111 로 참가자·성적·우승자에 종류를 넣었지만, 값을 채우는 건 등록 폼뿐이었다.
-- 대시보드 가져오기(J&J Dash·BATTLE·DIV)는 kind 를 보내지 않아 기본값 'jnj' 로 들어갔고,
-- 그래서 DIV 부문에 넣은 참가자가 '종류: DIV' 필터에서 사라졌다.
--
-- kind 는 원래 그 부문(jnj_divisions.kind)의 사본이다. 사본을 손으로 맞추게 두면 또 어긋나므로
-- 트리거가 넣거나 고칠 때마다 부문에서 가져온다. 짝이 되는 부문이 없으면(자유 코드) 준 값을 그대로 둔다.
-- idempotent.

-- ── 참가자·성적·우승자 — 대회 + 부문 코드로 부문을 찾는다 ──────────────────────
create or replace function band123.sync_kind_from_division()
returns trigger
language plpgsql
set search_path = band123
as $$
declare
  v_kind text;
begin
  select d.kind into v_kind
    from band123.jnj_divisions d
   where d.edition_id = new.edition_id
     and d.code = new.division
   limit 1;
  if v_kind is not null then new.kind := v_kind; end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['jnj_participants', 'jnj_scores', 'jnj_winners'] loop
    execute format('drop trigger if exists trg_sync_kind on band123.%I', t);
    execute format(
      'create trigger trg_sync_kind before insert or update of edition_id, division on band123.%I
         for each row execute function band123.sync_kind_from_division()', t);
    -- 이미 들어간 행 되맞추기(가져오기로 넣은 것들).
    execute format(
      'update band123.%I r set kind = d.kind
         from band123.jnj_divisions d
        where d.edition_id = r.edition_id and d.code = r.division and r.kind <> d.kind', t);
  end loop;
end $$;

-- ── 심사위원 — 부문을 직접 가리킨다(division_id). '전 부문 공통'이면 준 값을 그대로. ──
create or replace function band123.sync_judge_kind_from_division()
returns trigger
language plpgsql
set search_path = band123
as $$
declare
  v_kind text;
begin
  if new.division_id is null then return new; end if;
  select d.kind into v_kind from band123.jnj_divisions d where d.id = new.division_id;
  if v_kind is not null then new.kind := v_kind; end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_kind on band123.jnj_judges;
create trigger trg_sync_kind
  before insert or update of division_id on band123.jnj_judges
  for each row execute function band123.sync_judge_kind_from_division();

update band123.jnj_judges j
   set kind = d.kind
  from band123.jnj_divisions d
 where d.id = j.division_id and j.kind <> d.kind;

notify pgrst, 'reload schema';
