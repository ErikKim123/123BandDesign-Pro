-- 0016: 회원가입(auth.users insert) 시 profiles(+오거나이저면 partners) 자동 생성.
-- 목적: 이메일 확인이 필요한 설정에서도 가입 즉시 신청이 DB에 기록되어
--       관리자가 오거나이저 신청을 바로 받아볼 수 있게 한다.
-- SECURITY DEFINER 로 RLS 우회(트리거는 신뢰 컨텍스트). 기존 클라이언트 ensureProfile/콜백과
-- 충돌하지 않도록 ON CONFLICT DO NOTHING 으로 멱등 처리.

create or replace function band123.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- account_type 메타데이터만 신뢰. 'partner' 외에는 모두 'customer' 로 클램프(admin 자가승격 방지).
  v_role text := case when meta->>'account_type' = 'partner' then 'partner' else 'customer' end;
begin
  insert into band123.profiles (id, email, name, phone, role)
  values (new.id, new.email, nullif(meta->>'name', ''), nullif(meta->>'phone', ''), v_role)
  on conflict (id) do nothing;

  if v_role = 'partner' then
    insert into band123.partners (user_id, company_name, country, biz_no)
    values (
      new.id,
      nullif(meta->>'company_name', ''),
      nullif(meta->>'country', ''),
      nullif(meta->>'biz_no', '')
    )
    on conflict (user_id) do nothing;  -- status 는 기본값 'pending'
  end if;

  return new;
end;
$$;

drop trigger if exists band123_on_auth_user_created on auth.users;
create trigger band123_on_auth_user_created
  after insert on auth.users
  for each row execute function band123.handle_new_user();
