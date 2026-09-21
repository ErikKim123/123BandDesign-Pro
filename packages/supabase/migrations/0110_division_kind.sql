-- 0110: 부문·심사위원에 '종류' — J&J · BATTLE · DIV
--
-- 부문(jnj_divisions)은 지금까지 전부 J&J 대회의 부문이라는 전제였다. 같은 대회 안에서
-- 배틀(BATTLE)·디비전(DIV) 형식의 부문도 운영하므로, 부문마다 종류를 적어 어드민에서 나눠 보고
-- 고객몰에서도 형식을 구분할 수 있게 한다. 대시보드 앱(battle.divisions · div.divisions)과는 별개 —
-- 이 값은 '고객몰에 어떤 형식으로 보여줄 부문인가' 를 뜻한다.
--
-- 기존 행은 코드에 'battle' 이 들어간 것만 battle 로, 나머지는 jnj 로 둔다(지금 등록된 배틀 부문 2건).
-- idempotent.

alter table band123.jnj_divisions
  add column if not exists kind text not null default 'jnj';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jnj_divisions_kind_check'
  ) then
    alter table band123.jnj_divisions
      add constraint jnj_divisions_kind_check check (kind in ('jnj', 'battle', 'div'));
  end if;
end $$;

comment on column band123.jnj_divisions.kind is
  '부문 종류 — jnj(J&J) | battle(BATTLE) | div(DIV). 어드민 필터·고객몰 표기에 쓴다.';

-- 이미 등록된 배틀 부문 되찾기. 이름·코드 어디에도 battle 이 없으면 J&J 로 남는다.
update band123.jnj_divisions
   set kind = 'battle'
 where kind = 'jnj'
   and (code ilike '%battle%' or coalesce(title_i18n->>'en', '') ilike '%battle%');

create index if not exists jnj_divisions_kind_idx on band123.jnj_divisions (kind, sort_order);

-- ── 심사위원 ──────────────────────────────────────────────────────────────────
-- 부문을 지정한 심사위원은 그 부문의 종류를 따르고, '전 부문 공통'(division_id is null)인 심사위원은
-- 이 값으로 어느 형식의 부문에 붙는지 정한다.
alter table band123.jnj_judges
  add column if not exists kind text not null default 'jnj';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jnj_judges_kind_check'
  ) then
    alter table band123.jnj_judges
      add constraint jnj_judges_kind_check check (kind in ('jnj', 'battle', 'div'));
  end if;
end $$;

comment on column band123.jnj_judges.kind is
  '심사위원 종류 — jnj | battle | div. 부문을 지정했으면 그 부문의 종류와 같게 둔다.';

-- 이미 부문이 붙어 있는 심사위원은 그 부문의 종류로 맞춘다.
update band123.jnj_judges j
   set kind = d.kind
  from band123.jnj_divisions d
 where d.id = j.division_id
   and j.kind <> d.kind;

create index if not exists jnj_judges_kind_idx on band123.jnj_judges (kind, sort_order);

notify pgrst, 'reload schema';
