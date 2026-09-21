-- 0116: 댄서 회원 → 오거나이저 신청·계약 동의·운영자 승인
--
-- 지금까지 오거나이저가 되는 길은 '가입할 때 계정 유형을 오거나이저로 고르는 것' 하나뿐이었다.
-- 이미 춤추러 다니는 회원이 행사를 열려면 계정을 새로 만들어야 했고, 그러면 주문·뱃지·포인트가
-- 갈라졌다. 쓰던 계정 그대로 신청하고, 약관에 동의하고, 운영자가 승인하면 오거나이저가 되게 한다.
--
-- 역할(profiles.role)은 'customer' 그대로 둔다 — web 은 고객 전용이라 role 을 바꾸면 그 회원이
-- 자기 주문·뱃지 화면에서 쫓겨난다. '오거나이저인가'는 partners.status='active' 로 판단한다.
-- idempotent.

-- ── 1) 신청서·계약 기록 칸 ────────────────────────────────────────────────────
alter table band123.partners add column if not exists contact text;
alter table band123.partners add column if not exists intro text;
alter table band123.partners add column if not exists applied_at timestamptz;
alter table band123.partners add column if not exists terms_version text;
alter table band123.partners add column if not exists terms_agreed_at timestamptz;
alter table band123.partners add column if not exists approved_at timestamptz;
alter table band123.partners add column if not exists approved_by uuid references band123.profiles(id) on delete set null;
alter table band123.partners add column if not exists rejected_at timestamptz;
alter table band123.partners add column if not exists reject_reason text;

comment on column band123.partners.terms_version is '동의한 주최자 약관 판(예: 2026-09). 약관을 고치면 판을 올리고 재동의를 받는다.';
comment on column band123.partners.contact is '연락처 — 운영자가 심사·연락에 쓴다(공개되지 않는다).';

-- 반려 상태 추가. 반려는 기록을 남기고 재신청을 받기 위한 것이라 행을 지우지 않는다.
alter table band123.partners drop constraint if exists partners_status_check;
alter table band123.partners
  add constraint partners_status_check check (status in ('pending', 'active', 'suspended', 'rejected'));

-- ── 2) 스스로 승인하지 못하게 ─────────────────────────────────────────────────
-- partners_own 정책은 본인 행에 ALL 을 허용한다(포털에서 회사 정보·정산정보를 고쳐야 하므로).
-- 그대로 두면 신청자가 자기 행의 status 를 'active' 로 적어 넣을 수 있다. 승인·수수료율처럼
-- '운영자가 정하는 칸'은 운영자가 아닐 때 옛 값으로 되돌린다.
create or replace function band123.partners_guard_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = band123
as $fn$
begin
  if band123.is_admin() then return new; end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.commission_rate := 0.10;
    new.approved_at := null;
    new.approved_by := null;
    new.rejected_at := null;
    new.reject_reason := null;
  else
    new.status := old.status;
    new.commission_rate := old.commission_rate;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.rejected_at := old.rejected_at;
    new.reject_reason := old.reject_reason;
    -- 동의 기록도 본인이 고칠 수 없다. 고치려면 다시 신청해야 한다(apply_organizer 가 definer).
    new.terms_version := old.terms_version;
    new.terms_agreed_at := old.terms_agreed_at;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_partners_guard on band123.partners;
create trigger trg_partners_guard
  before insert or update on band123.partners
  for each row execute function band123.partners_guard_admin_fields();

-- ── 3) 신청 ───────────────────────────────────────────────────────────────────
-- 이미 승인된 회원이 다시 부르면 아무것도 바꾸지 않는다(실수로 심사중으로 되돌아가지 않게).
create or replace function band123.apply_organizer(
  p_company_name text,
  p_country text,
  p_contact text,
  p_terms_version text,
  p_biz_no text default null,
  p_intro text default null
)
returns text
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if coalesce(btrim(p_company_name), '') = ''
     or coalesce(btrim(p_country), '') = ''
     or coalesce(btrim(p_contact), '') = ''
     or coalesce(btrim(p_terms_version), '') = '' then
    raise exception 'missing_fields' using errcode = '22023';
  end if;

  select status into v_status from partners where user_id = v_uid;
  if v_status in ('active', 'suspended') then
    return v_status;  -- 이미 오거나이저다. 신청서로 덮지 않는다.
  end if;

  insert into partners (user_id, company_name, country, biz_no, contact, intro,
                        status, applied_at, terms_version, terms_agreed_at,
                        rejected_at, reject_reason)
  values (v_uid, btrim(p_company_name), btrim(p_country), nullif(btrim(coalesce(p_biz_no, '')), ''),
          btrim(p_contact), nullif(btrim(coalesce(p_intro, '')), ''),
          'pending', now(), btrim(p_terms_version), now(), null, null)
  on conflict (user_id) do update
     set company_name = excluded.company_name,
         country = excluded.country,
         biz_no = excluded.biz_no,
         contact = excluded.contact,
         intro = excluded.intro,
         status = 'pending',
         applied_at = now(),
         terms_version = excluded.terms_version,
         terms_agreed_at = now(),
         rejected_at = null,
         reject_reason = null;

  return 'pending';
end;
$fn$;
revoke all on function band123.apply_organizer(text, text, text, text, text, text) from public;
grant execute on function band123.apply_organizer(text, text, text, text, text, text) to authenticated;

-- ── 4) 운영자 심사 ────────────────────────────────────────────────────────────
create or replace function band123.admin_review_organizer(
  p_user_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = band123
as $fn$
declare
  v_status text;
begin
  if not band123.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_approve then
    update partners
       set status = 'active', approved_at = now(), approved_by = auth.uid(),
           rejected_at = null, reject_reason = null
     where user_id = p_user_id
     returning status into v_status;
  else
    update partners
       set status = 'rejected', rejected_at = now(),
           reject_reason = nullif(btrim(coalesce(p_reason, '')), ''),
           approved_at = null, approved_by = null
     where user_id = p_user_id
     returning status into v_status;
  end if;

  if v_status is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_status;
end;
$fn$;
revoke all on function band123.admin_review_organizer(uuid, boolean, text) from public;
grant execute on function band123.admin_review_organizer(uuid, boolean, text) to authenticated;

-- ── 5) '오거나이저인가' 판정 확장 ──────────────────────────────────────────────
-- 예전 계정은 role='partner' 로 구분했다. 이제 쓰던 계정 그대로 승인받는 길이 생겼으므로
-- 승인된 오거나이저 행이 있으면 그 사람도 오거나이저다(상품 이미지 업로드 정책 등이 이 함수를 쓴다).
create or replace function band123.is_partner()
returns boolean
language sql
stable
security definer
set search_path = band123
as $fn$
  select exists (select 1 from profiles where id = auth.uid() and role = 'partner')
      or exists (select 1 from partners where user_id = auth.uid() and status = 'active');
$fn$;

notify pgrst, 'reload schema';
