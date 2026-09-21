-- 0112: 코드관리 — BATTLE·DIV 부문 코드 그룹 씨앗
--
-- 0110 으로 부문에 종류가 생겼고, 코드관리에도 종류별 그룹(battle_division · div_division 등)이 생겼다.
-- 새 그룹은 비어 있으면 드롭다운이 빈 채로 뜬다. 이미 등록된 배틀 부문의 코드를 그대로 옮겨 담아
-- 첫 화면부터 고를 것이 있게 한다. DIV 는 아직 등록된 부문이 없어 비워 둔다(운영자가 채운다).
--
-- is_system=false — 운영자가 이름을 고치거나 지울 수 있다(J&J 표준 코드와 달리 참조가 고정돼 있지 않다).
-- idempotent.

insert into band123.code_values (group_key, code, label_i18n, note, sort_order, is_active, is_system)
select
  'battle_division',
  d.code,
  jsonb_build_object(
    'ko', coalesce(nullif(d.title_i18n->>'ko', ''), d.title_i18n->>'en', d.code),
    'en', coalesce(nullif(d.title_i18n->>'en', ''), d.title_i18n->>'ko', d.code)
  ),
  '부문관리에 등록된 배틀 부문에서 옮겨 담음(0112)',
  row_number() over (order by d.sort_order, d.code),
  true,
  false
from (select distinct on (code) code, title_i18n, sort_order
        from band123.jnj_divisions where kind = 'battle'
       order by code, sort_order) d
on conflict (group_key, code) do nothing;

notify pgrst, 'reload schema';
