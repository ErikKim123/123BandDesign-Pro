-- Design Ref: §5.4 — 파트너 대표 이미지 업로드 허용 (Storage RLS)
-- ⚠️ Supabase SQL Editor 에서 0001~0012 적용 후 실행.
--
-- 문제: 0008 의 product-images 쓰기 정책이 관리자(is_admin)만 허용 →
--       파트너 포털에서 업로드 시 "new row violates row-level security policy".
-- 해결: 파트너(role='partner')도 product-images 버킷에 쓰기 허용.

-- 파트너 판별 헬퍼 (is_admin 과 동일 패턴, security definer 로 RLS 우회 조회)
create or replace function is_partner() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'partner'
  );
$$ language sql security definer stable set search_path = band123;

-- 파트너 업로드/교체/삭제 허용 (admin 정책과 OR 로 합쳐짐)
drop policy if exists "band123_product_images_partner_write" on storage.objects;
create policy "band123_product_images_partner_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'band123-product-images' and band123.is_partner())
  with check (bucket_id = 'band123-product-images' and band123.is_partner());
