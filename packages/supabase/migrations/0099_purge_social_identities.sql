-- 0099: 탈퇴 계정의 소셜 identity 정리 함수
--
-- 왜 필요한가: 탈퇴 익명화는 auth.users.email 만 tombstone 으로 바꾼다. auth.identities 에 남은
-- 구글 identity 는 원래 주소를 그대로 들고 있어서, GoTrue 가 가입 중복을 그 주소로 판정한다.
-- 결과적으로 같은 주소는 "가입하면 이미 가입됨 / 재설정하면 계정 없음"으로 갇힌다.
--
-- GoTrue 에는 관리자용 identity 해제 API 가 없고(unlink 는 본인 세션 토큰 전용), 탈퇴 계정은
-- 세션을 만들 수 없다. 그래서 service_role 이 RPC 로 부를 수 있는 SECURITY DEFINER 함수로 처리한다.
--
-- email identity 는 남긴다 — identity 가 하나도 없는 계정을 만들지 않기 위해서다.

create or replace function band123.purge_social_identities(target_user uuid)
returns integer
language plpgsql
security definer
set search_path = band123, auth
as $$
declare
  removed integer;
begin
  delete from auth.identities
   where user_id = target_user
     and provider <> 'email';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function band123.purge_social_identities(uuid) from public, anon, authenticated;
grant execute on function band123.purge_social_identities(uuid) to service_role;
