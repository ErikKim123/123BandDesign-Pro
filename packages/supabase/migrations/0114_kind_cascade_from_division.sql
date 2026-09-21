-- 0114: 부문의 종류를 바꾸면 그 아래 기록도 따라간다
--
-- 0113 은 '넣을 때' 부문에서 종류를 가져왔다. 반대 방향이 비어 있었다 — 부문을 J&J 로 잘못 만든 뒤
-- 기록을 넣고, 나중에 부문관리에서 종류를 고쳐도 이미 들어간 참가자·성적·우승자·심사위원은
-- 옛 종류로 남아 필터에서 사라졌다.
--
-- 부문을 고치는 건 드문 일이고 한 부문에 딸린 행은 많아야 수백 건이라 그 자리에서 바로 맞춘다.
-- idempotent.

create or replace function band123.cascade_kind_to_records()
returns trigger
language plpgsql
set search_path = band123
as $$
begin
  if new.kind is not distinct from old.kind then return new; end if;

  update band123.jnj_participants
     set kind = new.kind
   where edition_id = new.edition_id and division = new.code and kind <> new.kind;
  update band123.jnj_scores
     set kind = new.kind
   where edition_id = new.edition_id and division = new.code and kind <> new.kind;
  update band123.jnj_winners
     set kind = new.kind
   where edition_id = new.edition_id and division = new.code and kind <> new.kind;
  update band123.jnj_judges
     set kind = new.kind
   where division_id = new.id and kind <> new.kind;

  return new;
end;
$$;

drop trigger if exists trg_cascade_kind on band123.jnj_divisions;
create trigger trg_cascade_kind
  after update of kind on band123.jnj_divisions
  for each row execute function band123.cascade_kind_to_records();

notify pgrst, 'reload schema';
