-- 0071: 라이브 방송 ↔ J&J 대회(에디션) 연결.
--
-- 배경: 0069 는 방송을 '행사(products.ticket)'에만 붙일 수 있었다. 그런데 잭앤질 대회는
--   /jnj 페이지가 따로 있고, 그 대회를 보러 온 사람이 라이브에 가장 먼저 닿아야 한다.
--   에디션이 행사와 연결돼 있지 않은 경우도 많아(연결 행사 = 선택) 행사 경유로는 닿지 않는다.
--   → 방송에 에디션을 직접 붙일 수 있게 한다. 둘 다 선택이고, 둘 다 비어 있어도 방송은 성립한다.
-- idempotent.

alter table live_broadcasts
  add column if not exists jnj_edition_id uuid references jnj_editions(id) on delete set null;

comment on column live_broadcasts.jnj_edition_id is
  '연결된 J&J 대회(에디션). 방송 중이면 /jnj 의 그 대회 화면에 라이브 시청 버튼이 뜬다.';

-- 대회 화면이 "이 대회의 방송 중인 라이브"를 찾을 때 쓰는 인덱스.
create index if not exists live_broadcasts_jnj_idx
  on live_broadcasts (jnj_edition_id, status);
