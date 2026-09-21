-- 0100: 행사 피드백 설문 (행사가 끝난 뒤 받는 8단계 설문)
--
-- 후기(product_reviews)와 다른 물건이다. 후기는 '다른 손님에게 보여 주는 공개 평가'고,
-- 이건 '주최자만 보는 운영 개선용 설문'이다. 그래서 답변은 공개하지 않는다.
--
-- 누구나(비로그인 포함) 쓸 수 있다 — 행사에 온 사람 대부분은 계정이 없고, 설문은 응답률이
-- 곧 쓸모라서 로그인 벽을 세우지 않는다. 대신 답이 남의 눈에 띄지 않게 읽기를 잠근다.

alter table products add column if not exists feedback_enabled boolean not null default false;
comment on column products.feedback_enabled is '행사 피드백 설문 받기 — 주최자가 행사 종료 후 켠다.';

create table if not exists event_feedback (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  -- 로그인 상태로 냈으면 누구인지 남긴다. 비로그인이면 null.
  author_id uuid references auth.users(id) on delete set null,
  -- 비로그인 중복 접수를 막는 열쇠 — 방문자 쿠키(band_vid). 쿠키를 지우면 뚫리지만,
  -- 여기서 막고 싶은 것은 '뒤로 가서 또 내기' 같은 실수와 가벼운 장난이다.
  visitor_id text,
  -- 설문 안에서 직접 적은 이름·이메일(둘 다 선택). 계정 정보와 별개다.
  respondent_name text,
  respondent_email text,
  -- 문항 코드 → 답. 문항은 코드에서 고정 정의하고(모든 행사 공통) 여기엔 답만 담는다.
  -- 8단계가 통째로 한 행이라, 중간에 문항이 늘어도 옛 응답이 깨지지 않는다.
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists event_feedback_product_idx on event_feedback (product_id, created_at desc);
-- 중복 접수 확인용 — 한 행사 안에서 같은 사람/방문자를 찾는다.
create index if not exists event_feedback_author_idx on event_feedback (product_id, author_id);
create index if not exists event_feedback_visitor_idx on event_feedback (product_id, visitor_id);

alter table event_feedback enable row level security;

-- 읽기: 그 행사를 파는 주최자와 운영자만. 응답에 이름·이메일·'누구 수업이 별로였다' 같은
-- 말이 담기므로 공개 읽기는 열지 않는다(후기와 가장 크게 다른 점).
drop policy if exists event_feedback_select on event_feedback;
create policy event_feedback_select on event_feedback
  for select using (
    exists (select 1 from products p where p.id = event_feedback.product_id and p.seller_id = auth.uid())
    or exists (select 1 from profiles pr where pr.id = auth.uid() and pr.role = 'admin')
  );

-- '이 행사가 설문을 받는 중인가'를 되묻는 함수.
--
-- 정책 안에서 products 를 그냥 조회하면 products 의 RLS 를 그대로 탄다. 그러면 123Band에 전시하지
-- 않는 행사(끝난 행사를 목록에서 내리는 건 흔한 일이다)는 비로그인에게 안 보여서, 설문을 켜 뒀는데도
-- 응답이 조용히 거부된다. 설문을 여는 기준은 전시 여부가 아니라 feedback_enabled 하나여야 하므로
-- security definer 로 그 한 가지만 본다.
create or replace function band123.feedback_open(target_product uuid)
returns boolean
language sql
stable
security definer
set search_path = band123
as $$
  -- status 는 보지 않는다. 끝난 행사는 대개 soldout 이고, 설문이 필요한 때가 바로 그때다.
  select exists (
    select 1 from products p where p.id = target_product and p.feedback_enabled = true
  );
$$;

revoke all on function band123.feedback_open(uuid) from public;
grant execute on function band123.feedback_open(uuid) to anon, authenticated, service_role;

-- 쓰기: 설문을 켜 둔 행사에만, 누구나. author_id 를 남길 거면 본인 것이어야 한다
-- (남의 id 를 달아 응답을 심는 것을 막는다).
drop policy if exists event_feedback_insert on event_feedback;
create policy event_feedback_insert on event_feedback
  for insert with check (
    band123.feedback_open(event_feedback.product_id)
    and (author_id is null or author_id = auth.uid())
  );

-- 지우기: 주최자·운영자만. 수정은 아무도 못 한다 — 받은 응답을 고칠 수 있으면 설문이 아니다.
drop policy if exists event_feedback_delete on event_feedback;
create policy event_feedback_delete on event_feedback
  for delete using (
    exists (select 1 from products p where p.id = event_feedback.product_id and p.seller_id = auth.uid())
    or exists (select 1 from profiles pr where pr.id = auth.uid() and pr.role = 'admin')
  );
