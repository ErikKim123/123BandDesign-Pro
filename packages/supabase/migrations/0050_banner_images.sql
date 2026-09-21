-- 0050: 배너 이미지 업로드용 버킷 — 어드민에서 배너 이미지를 URL 로 적는 대신 파일로 올린다.
-- 어드민 > 메인화면관리(히어로 슬라이드) / 배너관리 의 '이미지' 필드가 이 버킷에 올린다.
-- 정책은 0040(badges) 과 동일 철학: 공개 읽기(홈에서 <img> 로 로드) + 어드민만 쓰기.
-- 기존 행의 외부 URL(picsum 등)은 그대로 두고, 새로 올린 것부터 이 버킷을 쓴다.
-- idempotent.

insert into storage.buckets (id, name, public)
values ('band123-banners', 'band123-banners', true)
on conflict (id) do update set public = true;

drop policy if exists "band123_banners_public_read" on storage.objects;
create policy "band123_banners_public_read" on storage.objects
  for select using (bucket_id = 'band123-banners');

drop policy if exists "band123_banners_admin_write" on storage.objects;
create policy "band123_banners_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'band123-banners' and band123.is_admin())
  with check (bucket_id = 'band123-banners' and band123.is_admin());
