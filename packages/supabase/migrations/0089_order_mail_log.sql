-- Design Ref: 주문 상세에 '구매확인 메일 보냈는지'를 보여주기 위한 발송 기록.
--
-- 지금까지 메일은 보내고 끝이었다. 그래서 오거나이저가 현장에서 "이 손님에게 확인서가 갔나?"를
-- 알 방법이 없었고, 재발송 버튼을 눌러도 눌렀는지조차 화면에 남지 않았다.
--
-- 이 표는 '보냈다는 사실'만 남긴다. 본문은 남기지 않는다 — 메일 본문은 mail_templates 가 원본이고,
-- 주문마다 본문을 복제해 두면 템플릿을 고쳤을 때 어느 쪽이 진짜인지 알 수 없어진다.
--
-- idempotent: create table if not exists + drop policy if exists.

create table if not exists order_mail_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  -- 어떤 메일인지. 지금은 구매확인뿐이지만 나중에 늘어날 수 있다.
  kind text not null default 'order_confirmation',
  locale text not null default 'en',
  to_email text not null,
  -- 자동 발송이면 null, 사람이 눌러 보냈으면 누가 눌렀는지.
  sent_by uuid references profiles(id) on delete set null,
  -- Brevo 가 돌려준 messageId — 나중에 로그에서 그 메일을 되짚을 때 쓴다.
  provider_message_id text,
  sent_at timestamptz not null default now()
);

create index if not exists idx_order_mail_log_order on order_mail_log(order_id, sent_at desc);

comment on table order_mail_log is '주문 관련 메일 발송 기록. 본문은 남기지 않는다(원본은 mail_templates).';
comment on column order_mail_log.sent_by is '자동 발송이면 null, 수동 재발송이면 누른 사람.';

-- ── RLS ────────────────────────────────────────────────────────────────────
-- 판매자는 자기 상품이 든 주문의 기록만, 구매자는 자기 주문의 기록만 본다.
alter table order_mail_log enable row level security;

-- 호출자가 이 주문의 판매자인가. 0025 is_my_buyer 와 같은 방식(함수로 좁혀 정책을 단순하게).
create or replace function is_order_seller(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = band123
as $$
  select exists (
    select 1 from order_items oi
    where oi.order_id = p_order and oi.seller_id = auth.uid()
  );
$$;

revoke all on function is_order_seller(uuid) from public;
revoke all on function is_order_seller(uuid) from anon;
grant execute on function is_order_seller(uuid) to authenticated;

drop policy if exists order_mail_log_read on order_mail_log;
create policy order_mail_log_read on order_mail_log for select
  using (
    is_admin()
    or is_order_seller(order_id)
    or exists (select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid())
  );

-- 쓰기는 운영자와 '그 주문의 판매자'만. 자동 발송(web)은 service_role 이라 RLS 를 우회한다.
drop policy if exists order_mail_log_write on order_mail_log;
create policy order_mail_log_write on order_mail_log for insert
  with check (is_admin() or is_order_seller(order_id));
