-- 0023_product_qna.sql
-- 상품별 문의(product_qna) + 상품에 QnA 게시판 사용 여부(qna_enabled).
-- 질문: 로그인 고객. 답변: 해당 상품 판매자(오거나이저) 또는 관리자. 조회: 공개.
-- (후기 0022 와 동일 패턴 — 단, 별점 없음 / 사용자당 질문 여러 개 허용 / 답변 컬럼 추가)

-- 1) 상품별 QnA 사용 여부 (오거나이저가 상세페이지 생성 시 설정)
alter table products
  add column if not exists qna_enabled boolean not null default true;

-- 2) 문의 테이블
create table if not exists product_qna (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_name text,                      -- 질문자 표시명 비정규화
  question text not null,
  answer text,                           -- 판매자/관리자 답변 (없으면 답변 대기)
  answered_by uuid references profiles(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_qna_product_idx
  on product_qna (product_id, created_at desc);

-- 3) RLS
alter table product_qna enable row level security;

-- 공개 조회
drop policy if exists product_qna_select on product_qna;
create policy product_qna_select on product_qna
  for select using (true);

-- 로그인 사용자가 본인 명의로만 질문 작성
drop policy if exists product_qna_insert on product_qna;
create policy product_qna_insert on product_qna
  for insert with check (auth.uid() = author_id);

-- 답변(수정): 해당 상품 판매자(오거나이저) 또는 관리자만
drop policy if exists product_qna_update on product_qna;
create policy product_qna_update on product_qna
  for update using (
    exists (select 1 from products p where p.id = product_qna.product_id and p.seller_id = auth.uid())
    or exists (select 1 from profiles pr where pr.id = auth.uid() and pr.role = 'admin')
  ) with check (
    exists (select 1 from products p where p.id = product_qna.product_id and p.seller_id = auth.uid())
    or exists (select 1 from profiles pr where pr.id = auth.uid() and pr.role = 'admin')
  );

-- 삭제: 질문 작성자 본인 또는 관리자
drop policy if exists product_qna_delete on product_qna;
create policy product_qna_delete on product_qna
  for delete using (
    auth.uid() = author_id
    or exists (select 1 from profiles pr where pr.id = auth.uid() and pr.role = 'admin')
  );

-- 관리자 전체 접근(모더레이션)
drop policy if exists product_qna_admin_all on product_qna;
create policy product_qna_admin_all on product_qna
  for all
  using (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.role = 'admin'))
  with check (exists (select 1 from profiles pr where pr.id = auth.uid() and pr.role = 'admin'));

-- 4) 컬럼 단위 UPDATE 제한 — 답변 관련 컬럼만 갱신 허용.
-- RLS 는 '어느 행'만 통제하고 '어느 컬럼'은 통제하지 못한다. 판매자/관리자가 답변만
-- 달도록 의도했으므로, 고객 질문 원문(question)·작성자(author_id/author_name)를 변조하지
-- 못하게 GRANT 로 갱신 가능 컬럼을 답변 필드로 제한한다. (service_role 은 영향 없음)
revoke update on product_qna from anon, authenticated;
grant update (answer, answered_by, answered_at, updated_at) on product_qna to authenticated;
