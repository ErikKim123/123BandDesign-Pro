-- Design Ref: 오거나이저(판매자) 대시보드/판매내역에 '구매자 이름'을 표시하기 위한 RLS 보강.
-- 배경: profiles 는 RLS(profiles_self) 상 본인/admin 만 SELECT 가능 → 판매자가 구매자 프로필을
--       임베드(orders→profiles)해도 null 이 반환된다.
-- 조치: 판매자가 '자기 상품을 구매한' 사용자의 프로필만 읽도록 SELECT 정책 추가(읽기 전용, 가산).
--       RLS 서브쿼리 재귀/비용을 피하기 위해 SECURITY DEFINER 헬퍼로 판별한다.
--       (쿼리에서 name 만 SELECT 하므로 이름만 노출. 정책은 OR 로 합쳐져 기존 접근에 영향 없음.)
-- idempotent: create or replace / drop policy if exists.

-- 1) 판별 헬퍼 — 현재 사용자가 판매자이고, p_buyer 가 그 상품을 구매한 사람인지 --------
create or replace function is_my_buyer(p_buyer uuid)
returns boolean
language sql
stable
security definer
set search_path = band123
as $$
  select exists (
    select 1
    from order_items oi
    join orders o on o.id = oi.order_id
    where oi.seller_id = auth.uid()
      and o.buyer_id = p_buyer
  );
$$;

revoke all on function is_my_buyer(uuid) from public;
grant execute on function is_my_buyer(uuid) to authenticated;

-- 2) 판매자 → 구매자 프로필 읽기 정책(가산) -----------------------------------------
drop policy if exists "profiles_seller_read_buyers" on profiles;
create policy "profiles_seller_read_buyers" on profiles
  for select using (is_my_buyer(id));
