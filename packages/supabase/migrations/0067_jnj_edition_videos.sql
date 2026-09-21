-- 0067: J&J 에디션 영상 링크 — 대회별 관련 영상(유튜브·비메오·동영상파일) 최대 3개.
-- 고객몰 /jnj 에서 '영상 보기' 버튼 → 모달 플레이어로 재생한다. 링크가 없으면 버튼도 안 보인다.
-- idempotent.

alter table jnj_editions
  add column if not exists video_urls text[] not null default '{}'::text[];

comment on column jnj_editions.video_urls is
  '대회 관련 영상 링크(최대 3개). 유튜브/비메오/mp4 URL. 고객몰에서 모달 플레이어로 재생.';

-- 최대 3개 — 어드민 폼에서도 막지만 DB 에서도 보증한다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jnj_editions_video_urls_max3'
  ) then
    alter table jnj_editions
      add constraint jnj_editions_video_urls_max3
      check (coalesce(array_length(video_urls, 1), 0) <= 3);
  end if;
end $$;
