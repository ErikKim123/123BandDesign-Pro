-- 0115: 부문 코드를 바꾸면 그 아래 기록도 따라간다
--
-- 참가자·성적·우승자는 부문을 코드(text)로 가리킨다. 부문관리에서 코드를 고치면 그 기록들이
-- 어느 부문에도 붙지 않는 '떠도는 코드'가 됐다 — 고객몰 탭 줄에는 등록되지 않은 코드로
-- 한 칸이 더 생기고(부문 이름 대신 코드가 그대로 찍힌다), 새 코드의 부문은 텅 빈다.
-- 실제로 JLCF 2026 에서 salsa-solo → div-salsa-solo 로 고친 뒤 그렇게 됐다.
--
-- 0114(종류)와 같은 규칙으로 코드도 따라가게 한다.
-- idempotent.

create or replace function band123.cascade_code_to_records()
returns trigger
language plpgsql
set search_path = band123
as $$
begin
  if new.code is not distinct from old.code then return new; end if;

  update band123.jnj_participants
     set division = new.code
   where edition_id = new.edition_id and division = old.code;
  update band123.jnj_scores
     set division = new.code
   where edition_id = new.edition_id and division = old.code;
  update band123.jnj_winners
     set division = new.code
   where edition_id = new.edition_id and division = old.code;

  return new;
end;
$$;

drop trigger if exists trg_cascade_code on band123.jnj_divisions;
create trigger trg_cascade_code
  after update of code on band123.jnj_divisions
  for each row execute function band123.cascade_code_to_records();

-- ── 이미 떨어져 나간 기록 되붙이기 ────────────────────────────────────────────
-- 규칙을 넓게 잡으면 엉뚱한 부문에 붙을 수 있어, 딱 한 경우만 고친다:
--   같은 대회 안에서 옛 코드('salsa-solo')를 쓰는 부문은 이제 없고,
--   새 코드('div-salsa-solo')를 쓰는 부문은 있다.
do $$
declare
  v_ed uuid;
begin
  select d.edition_id into v_ed
    from band123.jnj_divisions d
   where d.code = 'div-salsa-solo'
     and not exists (
       select 1 from band123.jnj_divisions x
        where x.edition_id = d.edition_id and x.code = 'salsa-solo')
   limit 1;
  if v_ed is null then return; end if;

  update band123.jnj_participants set division = 'div-salsa-solo'
   where edition_id = v_ed and division = 'salsa-solo';
  update band123.jnj_scores set division = 'div-salsa-solo'
   where edition_id = v_ed and division = 'salsa-solo';
  update band123.jnj_winners set division = 'div-salsa-solo'
   where edition_id = v_ed and division = 'salsa-solo';
end $$;

notify pgrst, 'reload schema';
