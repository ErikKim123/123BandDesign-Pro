-- Design Ref: 회원 프로필 사진 — 생성 캐릭터 대신 본인 사진/원하는 이미지를 쓸 수 있게.
--
-- 기존 아바타는 avatar_seed + avatar_traits 로 그려내는 벡터 캐릭터다. 그 값은 그대로 두고
-- avatar_url 만 얹는다(대체가 아니라 우선순위):
--   avatar_url 이 있으면 사진, 없으면 지금처럼 캐릭터.
-- 사진을 지우면 고르던 캐릭터가 그대로 돌아온다 — 되돌릴 곳이 없어지면 안 된다.
--
-- idempotent: add column if not exists + on conflict do nothing + drop policy if exists.

alter table profiles add column if not exists avatar_url text;

comment on column profiles.avatar_url is
  '회원이 올린 프로필 사진 URL. 있으면 캐릭터(avatar_seed/traits) 대신 이 사진을 쓴다. 비우면 캐릭터로 되돌아간다.';

-- ── 스토리지 버킷 ───────────────────────────────────────────────────────────
-- 공개 버킷인 이유: 이 사진은 하트 목록·QR 프로필처럼 남이 보는 자리에 쓰인다.
-- 서명 URL 로 하면 목록을 그릴 때마다 회원 수만큼 서명을 발급해야 한다.
-- 대신 경로에 uid 를 넣어 '남의 파일을 덮어쓰는 것'만 정책으로 막는다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'band123-member-avatars', 'band123-member-avatars', true,
  5242880,  -- 5MB. 업로드 전에 클라이언트가 한 번 줄이지만, 서버에도 벽을 둔다.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 스토리지 정책 ───────────────────────────────────────────────────────────
-- 경로 규칙: member-avatars/{uid}/{timestamp}.{ext}
-- 첫 폴더가 본인 uid 일 때만 쓰기/수정/삭제할 수 있다.
drop policy if exists band123_member_avatars_public_read on storage.objects;
create policy band123_member_avatars_public_read on storage.objects for select
  using (bucket_id = 'band123-member-avatars');

drop policy if exists band123_member_avatars_own_insert on storage.objects;
create policy band123_member_avatars_own_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'band123-member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists band123_member_avatars_own_update on storage.objects;
create policy band123_member_avatars_own_update on storage.objects for update to authenticated
  using (
    bucket_id = 'band123-member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists band123_member_avatars_own_delete on storage.objects;
create policy band123_member_avatars_own_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'band123-member-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
