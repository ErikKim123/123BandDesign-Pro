-- 0123: 공유 로그인 계정에서 123Band 회원만 골라내기.
--
-- 로그인 계정(auth.users)은 울프·JNJ 와 공유한다. 계정마다 어느 서비스 회원인지를
-- app_metadata.services 배열에 태그로 단다(예: ["band123"]). app_metadata 는 service_role 만
-- 고칠 수 있고 JWT 에 그대로 실리므로 RLS 에서 바로 읽을 수 있다.
--
--   가입: 123Band 가입 화면은 user_metadata.service = 'band123' 을 넘긴다
--         → band123_tag_service 가 태그를 달고, band123_on_auth_user_created 가 band123.profiles 를 만든다.
--   로그인: 태그가 없는 계정(울프 회원 등)은 앱 미들웨어에서 차단한다.
--   DB: RLS 가 켜진 band123 테이블마다 restrictive 정책을 걸어, 태그 없는 로그인 사용자는 행을 못 본다.
--       (새 테이블을 만들면 맨 아래 루프를 그 테이블에도 적용할 것)

-- 1) 태그 확인 — 현재 요청의 JWT 에 band123 태그가 있는가
create or replace function band123.is_member()
returns boolean
language sql
stable
set search_path = band123
as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'services') ? 'band123', false);
$$;

grant execute on function band123.is_member() to anon, authenticated, service_role;

-- 2) 가입 시 태그 달기 — BEFORE INSERT 라 첫 토큰부터 태그가 실린다
create or replace function band123.tag_service()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_services jsonb := coalesce(new.raw_app_meta_data -> 'services', '[]'::jsonb);
begin
  if not v_services ? 'band123' then
    v_services := v_services || '["band123"]'::jsonb;
  end if;
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
                           || jsonb_build_object('services', v_services);
  return new;
end;
$$;

revoke all on function band123.tag_service() from public, anon, authenticated;

drop trigger if exists band123_tag_service on auth.users;
create trigger band123_tag_service
  before insert on auth.users
  for each row
  when (new.raw_user_meta_data ->> 'service' = 'band123')
  execute function band123.tag_service();

-- 3) 프로필 생성 트리거는 123Band 가입일 때만 돈다(0016 에서 만든 것을 조건부로 다시 건다)
drop trigger if exists band123_on_auth_user_created on auth.users;
create trigger band123_on_auth_user_created
  after insert on auth.users
  for each row
  when (new.raw_user_meta_data ->> 'service' = 'band123')
  execute function band123.handle_new_user();

-- 4) 태그 없는 로그인 사용자 차단 — RLS 가 켜진 band123 테이블 전부
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'band123'
       and c.relkind = 'r'
       and c.relrowsecurity
  loop
    execute format('drop policy if exists band123_members_only on band123.%I', t.relname);
    execute format(
      'create policy band123_members_only on band123.%I as restrictive for all to authenticated '
      'using (band123.is_member()) with check (band123.is_member())',
      t.relname
    );
  end loop;
end;
$$;
