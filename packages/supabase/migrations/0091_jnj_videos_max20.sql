-- Design Ref: J&J 영상 링크 상한 3 → 20.
--
-- 0067/0068 에서 3개로 잡아 뒀는데, 대회 하나에 부문별·라운드별 영상이 붙으면서 부족해졌다.
-- 상한을 아예 없애지 않고 20 으로 두는 이유: 한 대회 화면에 영상이 수십 개 붙으면 고객몰
-- 갤러리가 통째로 느려지고, 실수로 붙여넣기를 반복했을 때 막아 줄 벽이 없어진다.
--
-- 제약 이름에 개수가 박혀 있어(…_max3) 값만 바꿀 수 없다 — 지우고 새 이름으로 다시 건다.
-- idempotent: 있으면 지우고, 없으면 만든다.

-- ── jnj_editions ────────────────────────────────────────────────────────────
alter table jnj_editions drop constraint if exists jnj_editions_video_urls_max3;
alter table jnj_editions drop constraint if exists jnj_editions_video_urls_max20;
alter table jnj_editions
  add constraint jnj_editions_video_urls_max20
  check (coalesce(array_length(video_urls, 1), 0) <= 20);

comment on column jnj_editions.video_urls is
  '대회 영상 링크(최대 20개). 고객몰 대회 화면의 "영상 보기" 팝업에서 재생된다.';

-- ── jnj_divisions ───────────────────────────────────────────────────────────
alter table jnj_divisions drop constraint if exists jnj_divisions_video_urls_max3;
alter table jnj_divisions drop constraint if exists jnj_divisions_video_urls_max20;
alter table jnj_divisions
  add constraint jnj_divisions_video_urls_max20
  check (coalesce(array_length(video_urls, 1), 0) <= 20);

comment on column jnj_divisions.video_urls is
  '이 부문 전용 영상 링크(최대 20개). 비어 있으면 jnj_editions.video_urls 로 폴백.';
