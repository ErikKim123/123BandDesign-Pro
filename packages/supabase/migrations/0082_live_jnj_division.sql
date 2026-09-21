-- 0082: 라이브 방송 ↔ J&J 부문(division) 연결.
--
-- 배경: 0071 로 방송을 대회(에디션)에 붙일 수 있게 됐지만, 한 대회 안에는 부문이 여럿이고
--   (Bachata PRO / Bachata AMA / Salsa OPEN) 실제 방송은 그중 한 부문의 경기다.
--   대회에만 붙이면 어느 부문을 하는 중인지 화면이 말해 주지 못하고, 지금 보는 부문과
--   상관없는 방송 버튼이 모든 부문 탭에 똑같이 뜬다.
--   → 부문을 직접 붙일 수 있게 한다.
--
-- NULL 의 뜻은 심사위원(0053)과 같다: 부문을 안 고르면 그 대회 전 부문 공통이다.
-- 부문만 고르고 대회를 비워 두는 일은 없다 — 부문은 대회에 속하므로 어드민이 대회를 먼저 고른다.
-- idempotent.

alter table live_broadcasts
  add column if not exists jnj_division_id uuid references jnj_divisions(id) on delete set null;

comment on column live_broadcasts.jnj_division_id is
  '연결된 J&J 부문. 방송 중이면 그 부문 화면에 LIVE 섹션이 뜬다. NULL 이면 그 대회 전 부문 공통.';

-- 부문 화면이 "이 부문의 방송 중인 라이브"를 찾을 때 쓰는 인덱스.
create index if not exists live_broadcasts_jnj_division_idx
  on live_broadcasts (jnj_division_id, status);
