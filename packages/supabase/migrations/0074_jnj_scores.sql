-- 0074: J&J 점수관리 — 예선(prelim) · 본선(semi) · 결승(final) 전 라운드 성적표.
--
-- jnj_winners 와의 역할 분담:
--   · jnj_winners : 시상대(1~3위) 카드. 사진·코멘트·점수까지 붙는 '얼굴'.
--   · jnj_scores  : 대회 전체 성적표. 고객몰 /jnj 의 '전체 결과' 섹션이 이걸 읽는다.
--
-- 라운드마다 점수 체계가 다르다(J&J Dash 와 동일):
--   · prelim / semi : 심사위원 O표 수(votes) + 통과 여부(passed). 점수는 없다.
--   · final         : 순위(rank) + 최종(가중) 총점(total_score) + 평균(avg_score).
-- 한 테이블에 담고 라운드에 해당 없는 칸은 비워 둔다(화면에서 열째로 사라진다).
-- idempotent.

create table if not exists jnj_scores (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references jnj_editions(id) on delete cascade,
  -- 부문 코드 — jnj_winners.division · jnj_divisions.code 와 같은 값이어야 부문 탭에 붙는다.
  division text not null default 'pro',
  round text not null default 'final' check (round in ('prelim', 'semi', 'final')),
  role text not null default 'leader' check (role in ('leader', 'follower')),
  entry_no text not null default '',                   -- 참가번호. 예: '049'
  name text not null default '',
  country text,                                        -- ISO 3166-1 alpha-2
  -- 예선·본선
  votes int,                                           -- 심사위원 O표 수
  passed boolean,                                      -- 다음 라운드 진출 여부
  -- 결승
  rank int,
  total_score numeric(6,2),
  avg_score numeric(5,2),
  sort_order int not null default 0,                   -- 표 안 정렬(가져올 때 순위·O표 순으로 매긴다)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists jnj_scores_edition_idx
  on jnj_scores (edition_id, division, round, role, sort_order);

comment on table jnj_scores is 'J&J 전 라운드 성적표(예선 O표 · 본선 O표 · 결승 점수). 고객몰 /jnj 전체 결과 섹션.';

-- ── RLS — 공개 읽기(노출된 것) + 어드민 전체. jnj_winners 와 같은 규칙 ──
alter table jnj_scores enable row level security;

drop policy if exists "jnj_scores_public_read" on jnj_scores;
create policy "jnj_scores_public_read" on jnj_scores
  for select using (
    is_admin()
    or (
      is_active = true
      and exists (select 1 from jnj_editions e where e.id = edition_id and e.is_active)
    )
  );

drop policy if exists "jnj_scores_admin_write" on jnj_scores;
create policy "jnj_scores_admin_write" on jnj_scores
  for all using (is_admin()) with check (is_admin());
