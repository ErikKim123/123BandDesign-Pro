-- 0047_social_notifications.sql
-- 소셜 하트 알림 — (1) 인앱 안읽음 표시 (2) 웹푸시 구독 저장.
--
-- 배경: 하트는 축제 현장에서 QR 을 찍어 주고받는다. 받은 사람은 그 자리에서 알 방법이 없어
--       나중에 마이페이지에 들어와야 확인이 된다. 안읽음 카운트로 "뭔가 왔다"를 보여주고,
--       웹푸시로 앱이 닫혀 있어도 알린다.
--
-- ⚠️ 0043 의 profiles_social_guard 트리거는 profiles 의 social_code/referred_by/social_blocked_at
--    변경을 어드민 외에는 되돌린다. 이 마이그레이션은 profiles 를 건드리지 않으므로 무관하다.
-- ⚠️ 0046(소셜 리액션)과 독립적이다. 0046 은 social_hearts 에 kind 를 더하고 RPC 3종을 갱신하는데,
--    여기서 손대는 컬럼(read_at)·RPC(mark_hearts_read/my_unread_hearts/push_*)와 겹치지 않는다.
--    적용 순서는 상관없다.

-- 1) 안 읽은 하트 -------------------------------------------------------------
-- NULL = 아직 안 읽음. 읽은 시각을 남겨 두면 "언제 확인했는지"도 나중에 쓸 수 있다.
alter table band123.social_hearts add column if not exists read_at timestamptz;

-- 안읽음 개수는 마이페이지 진입마다 세므로 부분 인덱스로 받는다(읽은 행은 인덱스에 안 들어감).
create index if not exists idx_social_hearts_unread
  on band123.social_hearts (to_user_id)
  where read_at is null;

-- 받은 하트를 모두 읽음 처리하고 처리한 개수를 돌려준다. 소셜 탭 진입 시 1회 호출.
create or replace function band123.mark_hearts_read()
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
  update band123.social_hearts
     set read_at = now()
   where to_user_id = v_me
     and read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- 탭 배지용 안읽음 개수.
create or replace function band123.my_unread_hearts()
returns int
language sql
security definer
set search_path = band123
as $$
  select count(*)::int
  from band123.social_hearts
  where to_user_id = auth.uid()
    and read_at is null;
$$;

grant execute on function band123.mark_hearts_read() to authenticated;
grant execute on function band123.my_unread_hearts() to authenticated;

-- 앱을 열어둔 상태에서는 Realtime 으로 즉시 배지를 갱신한다.
-- (RLS 가 그대로 적용되므로 남의 하트는 구독해도 안 내려간다)
do $$
begin
  alter publication supabase_realtime add table band123.social_hearts;
exception
  when duplicate_object then null;  -- 이미 추가돼 있으면 통과
  when undefined_object then null;  -- publication 이 없는 환경(로컬 등)이면 무시
end;
$$;

-- 2) 웹푸시 구독 --------------------------------------------------------------
-- 브라우저 PushSubscription 하나가 한 행. 같은 사람이 폰/PC 여러 대를 쓰면 여러 행이 생긴다.
-- endpoint 가 사실상의 기기 식별자 → 유니크.
create table if not exists band123.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references band123.profiles(id) on delete cascade,
  endpoint text not null,
  -- 브라우저가 준 공개키/인증시크릿(base64url 원문 그대로 보관). 페이로드 암호화에 쓴다.
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- 발송 실패 누적. 404/410(구독 만료)이면 즉시 삭제하므로 여기 쌓이는 건 일시적 실패다.
  fail_count int not null default 0
);

create unique index if not exists uq_push_subscriptions_endpoint
  on band123.push_subscriptions (endpoint);
create index if not exists idx_push_subscriptions_user
  on band123.push_subscriptions (user_id);

alter table band123.push_subscriptions enable row level security;

-- 본인 구독만 보고 지울 수 있다. 남의 endpoint 는 조회 자체가 안 된다.
-- (발송은 서버가 service_role 로 읽는다 — RLS 우회)
drop policy if exists push_subscriptions_own on band123.push_subscriptions;
create policy push_subscriptions_own on band123.push_subscriptions
  for all using (user_id = auth.uid() or band123.is_admin())
  with check (user_id = auth.uid());

-- 구독 등록/갱신 — 같은 endpoint 가 다른 계정으로 재사용될 수 있어(공용 PC) user_id 도 덮어쓴다.
create or replace function band123.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'unauthorized';
  end if;
  if coalesce(btrim(p_endpoint), '') = ''
     or coalesce(btrim(p_p256dh), '') = ''
     or coalesce(btrim(p_auth), '') = '' then
    raise exception 'invalid_subscription';
  end if;

  insert into band123.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_me, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth), left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        fail_count = 0;
end;
$$;

create or replace function band123.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = band123
as $$
  delete from band123.push_subscriptions
  where endpoint = btrim(p_endpoint)
    and user_id = auth.uid();
$$;

grant execute on function band123.upsert_push_subscription(text, text, text, text) to authenticated;
grant execute on function band123.delete_push_subscription(text) to authenticated;

-- 3) 이메일 요약 수신 설정 ----------------------------------------------------
-- 하트 하나마다 메일을 보내면 스팸이 된다 → 하루 1회 요약. 기본 수신, 본인이 끌 수 있다.
alter table band123.profiles
  add column if not exists notify_email_digest boolean not null default true;

create or replace function band123.set_notify_prefs(p_email_digest boolean)
returns void
language sql
security definer
set search_path = band123
as $$
  update band123.profiles
     set notify_email_digest = coalesce(p_email_digest, true)
   where id = auth.uid();
$$;

grant execute on function band123.set_notify_prefs(boolean) to authenticated;

-- 요약 메일 발송용 집계 — 서버(cron)가 service_role 로만 호출한다.
-- 반환: 받는 사람 이메일/이름 + 그날 받은 하트 수 + 보낸 사람 이름 최대 5명.
create or replace function band123.heart_digest(p_date date)
returns table (
  user_id uuid,
  email text,
  name text,
  heart_count int,
  giver_names text[]
)
language sql
security definer
set search_path = band123
as $$
  select
    h.to_user_id,
    p.email,
    p.name,
    count(*)::int,
    (array_agg(
       coalesce(nullif(btrim(coalesce(g.name, '')), ''), g.social_code, '?')
       order by h.created_at desc
     ))[1:5]
  from band123.social_hearts h
  join band123.profiles p on p.id = h.to_user_id
  left join band123.profiles g on g.id = h.from_user_id
  where h.created_date = p_date
    and p.notify_email_digest
    -- 탈퇴(소프트 삭제) 계정은 이메일이 tombstone 으로 바뀌어 있다 → 발송 제외
    and p.email is not null
    and p.email not like '%@deleted.invalid'
    and p.social_blocked_at is null
  group by h.to_user_id, p.email, p.name;
$$;

-- 일반 사용자에게는 열지 않는다(남의 이메일이 들어있다). service_role 전용.
revoke execute on function band123.heart_digest(date) from public;
revoke execute on function band123.heart_digest(date) from anon, authenticated;
grant execute on function band123.heart_digest(date) to service_role;
