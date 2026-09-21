-- 울프(public) 쪽 변경 — 123Band 가 울프 객체를 고치는 유일한 곳.
--
-- 울프의 가입 트리거(on_auth_user_created → public.handle_new_user)는 auth.users 에 들어오는
-- 모든 계정에 울프 프로필을 만든다. 123Band 가입자까지 울프 회원이 되지 않도록,
-- user_metadata.service = 'band123' 인 가입만 건너뛰게 조건(WHEN)을 붙여 다시 건다.
-- 함수 본문은 건드리지 않는다. 울프 저장소에도 같은 마이그레이션을 넣어 둘 것.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  when (coalesce(new.raw_user_meta_data ->> 'service', '') <> 'band123')
  execute function public.handle_new_user();
