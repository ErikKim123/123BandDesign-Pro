-- 0080_member_notices.sql
-- 운영자 → 회원 알림(메시지). 어드민에서 보내면 회원 화면에 메시지처럼 뜨고 소리가 난다.
--
-- 왜 회원마다 한 행인가(팬아웃):
--   '공지 한 줄 + 읽은 사람 목록' 구조로 두면 읽음 표시·안읽음 개수를 낼 때마다 조인이 필요하고,
--   RLS 로 '내 것만' 가르기도 까다롭다. 받는 사람마다 행을 만들면 user_id 하나로 전부 해결된다
--   (RLS·안읽음 인덱스·Realtime 필터). 같은 발송은 batch_id 로 묶어 어드민에서 한 건으로 본다.
--
-- 전달 경로는 두 겹이다. 둘 다 이 테이블의 INSERT 에서 갈라진다:
--   1) 사이트를 열어둔 회원 — Realtime(postgres_changes)으로 즉시 메시지 카드 + 소리.
--   2) 닫아둔 회원 — 앱이 웹푸시로 보낸다(0047 의 push_subscriptions 재사용).
--      푸시는 DB 가 아니라 어드민이 발송 직후 앱 웹훅을 불러 보낸다 — 전체 발송이면 행이 수천 개라
--      행마다 트리거로 HTTP 를 쏘면 안 된다. 묶음(batch) 하나로 한 번만 부른다.
-- idempotent.

create table if not exists band123.member_notices (
  id uuid primary key default gen_random_uuid(),
  -- 받는 사람. 회원이 지워지면 알림도 같이 사라진다.
  user_id uuid not null references band123.profiles(id) on delete cascade,
  -- 같은 발송 묶음 — 어드민 '보낸 알림'에서 한 건으로 접어 본다.
  batch_id uuid not null default gen_random_uuid(),
  title text not null,
  body text not null,
  -- 누르면 갈 곳(선택). 비어 있으면 알림함에서 본문만 보여준다.
  link_url text,
  created_by uuid references band123.profiles(id) on delete set null,
  -- NULL = 아직 안 읽음.
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 알림함(최신순)과 안읽음 배지 — 두 질의가 전부다.
create index if not exists idx_member_notices_user
  on band123.member_notices (user_id, created_at desc);
create index if not exists idx_member_notices_unread
  on band123.member_notices (user_id)
  where read_at is null;
create index if not exists idx_member_notices_batch
  on band123.member_notices (batch_id, created_at desc);

alter table band123.member_notices enable row level security;

-- 읽기: 본인 것만(운영자는 전부 — 어드민 '보낸 알림'/읽음 현황).
drop policy if exists member_notices_select on band123.member_notices;
create policy member_notices_select on band123.member_notices
  for select using (user_id = auth.uid() or is_admin());

-- 쓰기: 운영자만. 회원의 읽음 처리는 아래 RPC 로만 한다
-- (update 정책을 열면 회원이 남의 알림 내용을 고칠 길이 생긴다).
drop policy if exists member_notices_admin on band123.member_notices;
create policy member_notices_admin on band123.member_notices
  for all using (is_admin()) with check (is_admin());

-- 발송 — 대상이 비면(null) 일반회원 전체. 탈퇴(tombstone) 계정은 빼고 보낸다.
-- 반환: { batch_id, sent } — 어드민이 "n명에게 보냈습니다"와 푸시 웹훅 호출에 쓴다.
create or replace function band123.send_member_notice(
  p_title text,
  p_body text,
  p_link text default null,
  p_user_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body  text := btrim(coalesce(p_body, ''));
  v_link  text := nullif(btrim(coalesce(p_link, '')), '');
  v_n int;
begin
  if not is_admin() then
    raise exception '관리자만 알림을 보낼 수 있습니다.' using errcode = '42501';
  end if;
  if v_title = '' or v_body = '' then
    raise exception '제목과 내용을 입력해 주세요.' using errcode = '22023';
  end if;

  insert into band123.member_notices (user_id, batch_id, title, body, link_url, created_by)
  select p.id, v_batch, v_title, v_body, v_link, auth.uid()
    from band123.profiles p
   where case
           when p_user_ids is null
             -- 전체 발송 대상은 '일반회원'이다. 운영자·오거나이저는 이 알림의 수신자가 아니다.
             then p.role = 'customer' and coalesce(p.email, '') not like '%@deleted.invalid'
           else p.id = any(p_user_ids)
         end;
  get diagnostics v_n = row_count;

  return jsonb_build_object('batch_id', v_batch, 'sent', v_n);
end;
$$;

-- 안읽음 개수 — 헤더 종 배지 · 마이페이지 탭 배지.
create or replace function band123.my_unread_notices()
returns int
language sql
security definer
set search_path = band123
as $$
  select count(*)::int
  from band123.member_notices
  where user_id = auth.uid()
    and read_at is null;
$$;

-- 읽음 처리 — 알림함에 들어오면 1회 호출(인자 없이 전체). 처리한 개수를 돌려준다.
create or replace function band123.mark_notices_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
  v_n int;
begin
  if v_me is null then
    return 0;
  end if;
  update band123.member_notices
     set read_at = now()
   where user_id = v_me
     and read_at is null
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function band123.send_member_notice(text, text, text, uuid[]) to authenticated;
grant execute on function band123.my_unread_notices() to authenticated;
grant execute on function band123.mark_notices_read(uuid[]) to authenticated;

-- 사이트를 열어둔 회원에게 즉시 띄우려면 Realtime 이 필요하다.
-- (RLS 가 그대로 적용되므로 남의 알림은 구독해도 안 내려간다)
do $$
begin
  alter publication supabase_realtime add table band123.member_notices;
exception
  when duplicate_object then null;  -- 이미 추가돼 있으면 통과
  when undefined_object then null;  -- publication 이 없는 환경(로컬 등)이면 무시
end;
$$;
