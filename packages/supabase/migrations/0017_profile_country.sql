-- 0017: profiles.country 추가 — 일반회원도 국가 정보를 보관/표시(어드민 회원관리 국가 컬럼·정렬).
-- 가입 시 수집한 country(ISO2, 예: KR/US)는 auth 메타데이터에만 있었는데, 이를 profiles 로
-- 승격해 어드민에서 회원을 국가별로 정렬/필터할 수 있게 한다.

-- 1) 컬럼 추가 (ISO2 국가코드. 자유 텍스트 허용 — 과거/외부 값 호환)
alter table band123.profiles
  add column if not exists country text;

-- 2) 가입 트리거가 country 도 함께 기록하도록 갱신
create or replace function band123.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := case when meta->>'account_type' = 'partner' then 'partner' else 'customer' end;
begin
  insert into band123.profiles (id, email, name, phone, role, country)
  values (
    new.id,
    new.email,
    nullif(meta->>'name', ''),
    nullif(meta->>'phone', ''),
    v_role,
    nullif(meta->>'country', '')
  )
  on conflict (id) do nothing;

  if v_role = 'partner' then
    insert into band123.partners (user_id, company_name, country, biz_no)
    values (
      new.id,
      nullif(meta->>'company_name', ''),
      nullif(meta->>'country', ''),
      nullif(meta->>'biz_no', '')
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- 3) 기존 회원 백필 — auth.users 메타데이터의 country 를 profiles 로 복사(비어 있는 행만)
update band123.profiles p
set country = nullif(u.raw_user_meta_data->>'country', '')
from auth.users u
where u.id = p.id
  and (p.country is null or p.country = '')
  and nullif(u.raw_user_meta_data->>'country', '') is not null;
