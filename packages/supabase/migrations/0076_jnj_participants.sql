-- 0076: J&J 참가자 — 대회에 나온 사람 전체(성적과 무관).
--
-- jnj_scores 가 '어떻게 갈렸나'라면 이 표는 '누가 나왔나'다. 예선에서 떨어진 사람도 남고,
-- 고객몰 /jnj 의 '전체 참여자' 섹션이 카드 그리드로 보여준다.
--
-- 개인정보: J&J Dash 참가신청에는 연락처·이메일도 있지만 여기로는 가져오지 않는다.
-- 공개 화면에 필요한 값(이름·국가·사진·SNS 핸들)만 담는다.
-- idempotent.

create table if not exists jnj_participants (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references jnj_editions(id) on delete cascade,
  -- 부문 코드 — jnj_scores.division · jnj_divisions.code 와 같은 값이어야 부문 탭에 붙는다.
  division text not null default 'pro',
  role text not null default 'leader' check (role in ('leader', 'follower')),
  entry_no text not null default '',                   -- 참가번호. 예: '049'
  name text not null default '',
  country text,                                        -- ISO 3166-1 alpha-2
  photo_url text,
  instagram text,                                      -- 핸들('@name') 또는 URL. 비면 링크가 안 붙는다.
  sort_order int not null default 0,                   -- 참가번호 순
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists jnj_participants_edition_idx
  on jnj_participants (edition_id, division, role, sort_order);

comment on table jnj_participants is
  'J&J 대회 참가자 명단(공개용). 고객몰 /jnj 전체 참여자 섹션. 연락처·이메일은 담지 않는다.';

-- ── RLS — 공개 읽기(노출된 것) + 어드민 전체. jnj_scores 와 같은 규칙 ──
alter table jnj_participants enable row level security;

drop policy if exists "jnj_participants_public_read" on jnj_participants;
create policy "jnj_participants_public_read" on jnj_participants
  for select using (
    is_admin()
    or (
      is_active = true
      and exists (select 1 from jnj_editions e where e.id = edition_id and e.is_active)
    )
  );

drop policy if exists "jnj_participants_admin_write" on jnj_participants;
create policy "jnj_participants_admin_write" on jnj_participants
  for all using (is_admin()) with check (is_admin());
