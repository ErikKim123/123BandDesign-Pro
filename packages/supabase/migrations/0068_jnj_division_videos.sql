-- 0068: J&J 부문 영상 링크 — 부문(탭)마다 다른 영상을 걸 수 있게 한다. 최대 3개.
-- 폴백 규칙은 FORMAT/GUIDELINES(0053) 와 같다: 부문 영상이 비어 있으면 대회(에디션, 0067) 공통 영상을 쓴다.
-- idempotent.

alter table jnj_divisions
  add column if not exists video_urls text[] not null default '{}'::text[];

comment on column jnj_divisions.video_urls is
  '이 부문 전용 영상 링크(최대 3개). 비어 있으면 jnj_editions.video_urls 로 폴백.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jnj_divisions_video_urls_max3'
  ) then
    alter table jnj_divisions
      add constraint jnj_divisions_video_urls_max3
      check (coalesce(array_length(video_urls, 1), 0) <= 3);
  end if;
end $$;
