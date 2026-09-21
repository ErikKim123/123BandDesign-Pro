# 파트너 입점형 쇼핑몰 구축 가이드 (PDCA 기반)

> 목적: 첨부한 목표(파트너 입점형 + 티켓 판매 + JNJ/DIV SaaS 구독 + AI 상품페이지 + 다국어)를
> **PDCA 사이클**로 쪼개서, 한 단계씩 Claude Code로 만들어 나가기 위한 작업 지침서.

---

## 0. 이 문서 사용법

**PDCA** = Plan(계획) → Do(실행) → Check(점검) → Act(개선). 한 바퀴 돌리고 나온 결과를 다음 바퀴 입력으로 넣는 방식.

이 프로젝트에서는 **Phase(단계) = PDCA 한 바퀴**로 본다. 한 번에 다 만들지 말고, Phase 0부터 순서대로 한 바퀴씩 돌린다.

**Claude Code 사용 흐름 (매 Phase 공통):**
1. 해당 Phase의 `Plan` 섹션을 읽고, 결정할 항목을 먼저 확정한다.
2. `Do`의 작업 목록을 Claude Code 프롬프트로 넘긴다. (한 번에 하나씩)
3. `Check`의 기준으로 동작을 확인한다.
4. `Act`에서 다음 Phase로 넘길 것 / 고칠 것을 정리한다.

> 팁: 이 문서 전체를 Claude Code 작업 폴더에 `GUIDE.md`로 넣어두고, 매 작업마다 "GUIDE.md의 Phase N을 참고해서 ~을 만들어줘"라고 지시하면 일관성이 유지된다.

---

## 1. 프로젝트 한눈에 보기

### 핵심 정체성
일반 쇼핑몰이 아니라 **4가지가 합쳐진 플랫폼**이다. 이걸 항상 기억해야 설계가 안 흔들린다.

1. **파트너 입점형 마켓플레이스** — 자사 상품 + 파트너(입점 판매자) 상품을 함께 판매. → 정산/수수료 개념 필요.
2. **티켓 판매** — 일반 실물 상품과 다른 타입의 상품(좌석/일시/QR 등).
3. **SaaS 구독(JNJ/DIV)** — 일회성 구매가 아니라 구독(반복 결제) 모델.
4. **AI 상품페이지 생성** — 이 사이트만의 차별점. 상품 정보 → AI가 상세페이지 HTML 자동 생성.

여기에 **다국어**(영어 기본 / 한국어 / 추후 일어·대만어)가 전 영역에 깔린다.

### 일반 쇼핑몰과 다른 설계 포인트
- 상품에 **타입(product_type)** 개념이 꼭 필요하다: `physical`(실물) / `ticket`(티켓) / `subscription`(구독).
- 주문 항목마다 **판매자(seller)** 가 다를 수 있다 (자사 vs 파트너).
- 배송은 **국내/해외 2종**으로 분기된다.
- 모든 "보이는 텍스트"는 **언어별로** 저장하거나 분리해야 한다.

### 기술 스택 (권장 — 기존에 쓰던 것 기준)
- **DB / Auth / Storage:** Supabase (Postgres)
- **백엔드 API:** NestJS (결제·정산·AI 호출 등 민감 로직)
- **프런트:** Next.js (App Router) — SSR로 SEO 확보(상품/메인), 다국어 라우팅
- **배포:** Vercel (프런트) + 백엔드는 별도 호스팅
- **결제:** PortOne(국내) + 해외 대응 시 Stripe 등 별도 검토
- **다국어:** `next-intl`(UI 텍스트) + DB의 언어별 컬럼(상품/배너 등 콘텐츠)

---

## 2. 전체 로드맵

| Phase | 단계 | 핵심 산출물 |
|---|---|---|
| **0** | DB 설계 | 테이블 스키마 + 관계도 + RLS 정책 (Supabase에 실제 생성) |
| **1** | 운영자 관리 페이지 | 관리자 로그인 + 각 관리 화면(회원/파트너/상품/주문/배송/게시판/배너/메인/카테고리) CRUD |
| **2** | 메인페이지 | 메인화면관리에서 만든 섹션(배너/추천상품/카테고리)을 렌더링 |
| **3** | 상품페이지 (+AI) | 상품 상세 렌더링 + **AI 상품페이지 생성 기능** |
| **4** | 나머지 기능 | 주문/결제, 배송(국내·해외), 게시판, 구독(JNJ/DIV), 티켓, 다국어 마감 |

> 순서 이유: 데이터 구조(0)가 먼저 서야 관리 화면(1)을 만들고, 관리 화면에서 데이터를 넣어야 메인(2)·상품(3)에 보여줄 게 생긴다. 고객용 결제/주문(4)은 보여줄 상품이 있어야 의미가 있다.

---

## 3. Phase별 PDCA 상세

### ▶ Phase 0 — DB 설계 (가장 먼저)

**Plan (먼저 결정할 것)**
- 다국어 저장 방식: **JSONB 컬럼 방식** 권장 (예: `name_i18n = {"en":..., "ko":...}`). → 4번 섹션 참고.
- "자사 상품(123Band)" vs "파트너 상품"을 어떻게 구분할지: `products.seller_id` + `is_partner_product` 플래그.
- 상품 타입을 `product_type`(physical/ticket/subscription)으로 한 테이블에서 관리할지, 분리할지 → **한 테이블 + 타입별 추가 속성은 JSONB** 권장(초기 단순화).
- 통화(currency) 처리: 영어 기본이면 다중 통화가 생길 수 있음 → `currency` 컬럼 + 가격 정책 결정.

**Do (작업)**
- [ ] Supabase 프로젝트 생성, `auth` 연동 확인
- [ ] 4번 섹션의 핵심 테이블 생성 (profiles → categories → products → orders → … 순서)
- [ ] 외래키(관계) 연결
- [ ] RLS 정책 적용 (고객/파트너/관리자 권한 분리)
- [ ] 시드 데이터 약간 넣기 (카테고리 몇 개, 샘플 상품 2~3개)

**Check (점검)**
- 관리자 계정으로 모든 테이블 조회 가능?
- 파트너 계정으로 **자기 상품만** 보이는가? (RLS 동작)
- 외래키 연결이 끊긴 곳 없는가? (orphan row)

**Act (개선/다음으로)**
- 빠진 컬럼·테이블을 메모 → Phase 1 만들면서 추가될 것 반영
- 스키마 확정본을 `schema.sql`로 저장해 버전 관리

---

### ▶ Phase 1 — 운영자 관리 페이지

**Plan**
- 관리자 인증: Supabase Auth + `role = 'admin'` 체크
- 관리 화면 목록 = 기존에 만든 시트와 동일하게: 회원 / 파트너 / 상품 / 카테고리 / 주문 / 배송 / 게시판 / 배너 / 메인화면
- 화면 패턴 통일: **목록(검색·필터) → 상세/편집 → 저장** 의 반복

**Do**
- [ ] 관리자 레이아웃(사이드바 네비) 1개 만들고 재사용
- [ ] 각 관리 화면 CRUD를 **하나씩** 구현 (회원관리부터)
- [ ] 파트너관리: 입점 신청 승인/반려 흐름 (status: pending→active)
- [ ] 상품관리: 자사/파트너 상품 구분 표시 + 승인 흐름
- [ ] 카테고리관리: 대/중 분류 트리 + 노출순서·노출여부

**Check**
- 각 화면에서 생성/수정/삭제가 DB에 반영되는가?
- 권한 없는 사용자가 관리 URL 접근 시 차단되는가?

**Act**
- 반복되는 UI는 공통 컴포넌트로 추출 (테이블, 폼)
- 자주 쓰는 필터/검색 패턴 정리

---

### ▶ Phase 2 — 메인페이지

**Plan**
- "메인화면관리"에서 정의한 섹션을 그대로 렌더링하는 구조
- 섹션 타입: hero배너 / 슬라이드배너 / 추천상품 / 카테고리띠 / 기획전 등

**Do**
- [ ] `main_sections` 데이터를 sort 순서대로 읽어 렌더링
- [ ] 배너 영역: `banners`에서 노출상태='노출중'인 것만 (날짜·사용여부 기준)
- [ ] 추천상품 영역: 상품 목록 조회 (상세 HTML은 제외하고 가볍게)
- [ ] 다국어: 현재 locale에 맞는 텍스트 출력

**Check**
- 관리 페이지에서 배너 추가 → 메인에 즉시 반영되는가?
- 노출 기간 지난 배너가 안 보이는가?
- 모바일/PC 반응형 확인

**Act**
- 로딩 속도 점검 (메인은 첫인상 → SSR/캐싱 전략)

---

### ▶ Phase 3 — 상품페이지 (+ AI 상품페이지 생성) ★차별점

**Plan**
- 상품 상세 = 기본정보(이름/가격/옵션) + **상세 HTML**(AI 생성 또는 수기)
- AI 생성 흐름을 먼저 종이에 그린다 → 5번 섹션 참고

**Do**
- [ ] 상품 상세 페이지: `detail_html_i18n`에서 현재 언어 HTML 렌더링 (sanitize 필수)
- [ ] 상품 목록 조회 시 `detail_html` 제외, 상세 진입 시에만 조회
- [ ] **AI 생성 기능** (관리/파트너용):
  - 입력: 상품명·핵심 키워드·특징·이미지 URL(들)
  - 처리: 백엔드(NestJS)에서 Claude API 호출 → 구조화된 HTML 블록 생성
  - 출력: 미리보기 → 확인 후 저장
  - 기본 언어(영어)로 생성 → 다른 언어는 번역 호출로 채움
- [ ] 생성 이력 저장 (`ai_product_jobs`)

**Check**
- 생성된 HTML이 깨지지 않고 렌더링되는가?
- XSS sanitize가 되는가? (`isomorphic-dompurify` 등)
- 이미지가 base64로 박히지 않고 Storage URL로 들어가는가?

**Act**
- 잘 나오는 프롬프트를 **템플릿으로 고정** → 상품마다 디자인 들쭉날쭉 방지
- 자주 쓰는 상품 카테고리별 생성 프리셋 정리

---

### ▶ Phase 4 — 나머지 기능

**Plan**
- 큰 덩어리: ① 주문/결제 ② 배송(국내·해외) ③ 게시판 ④ 구독(JNJ/DIV) ⑤ 티켓 ⑥ 다국어 마감
- 우선순위는 **돈이 흐르는 순서**: 주문·결제 → 배송 → 구독·티켓 → 게시판 → 다국어 전면 적용

**Do**
- [ ] 장바구니 → 주문 → 결제(PortOne) → 주문 생성
- [ ] 주문항목별 판매자(seller) 분리 저장 → 파트너 정산 근거
- [ ] 배송: 국내/해외 분기, 송장·배송상태 관리
- [ ] 구독: 플랜(JNJ/DIV) 정의, 반복결제, 구독상태 관리
- [ ] 티켓: 발권(QR/번호), 체크인 연계 검토 (123Pass와 연결 여지)
- [ ] 게시판: 공지/문의/리뷰/FAQ
- [ ] 다국어: UI 텍스트 전수 점검, 누락 언어 채우기

**Check**
- 결제 성공/실패/취소/환불 시나리오가 다 동작하는가?
- 파트너별 정산 금액이 주문 데이터로 정확히 계산되는가?
- 구독 갱신·해지가 정상 처리되는가?

**Act**
- 운영하며 나오는 버그·요청을 다시 Phase별 PDCA로 재투입 (지속 개선)

---

## 4. DB 설계 초안 (Phase 0 핵심)

> Supabase(Postgres) 기준. 아래는 **출발점 스케치**다. 그대로 쓰지 말고 Plan에서 결정한 내용 반영해 다듬을 것.

### 핵심 테이블 관계 (요약)
```
auth.users ─1:1─ profiles ─(role)─ customer / partner / admin
profiles ─1:N─ products (seller_id)        ← 파트너/자사 상품
categories ─(parent_id 자기참조)─ categories ← 대/중 분류
products ─N:1─ categories
orders ─1:N─ order_items ─N:1─ products
orders ─1:N─ shipments
profiles ─1:N─ subscriptions               ← JNJ/DIV 구독
banners / boards / main_sections / ai_product_jobs ← 독립 관리
```

### 주요 테이블 SQL (발췌)
```sql
-- 사용자 프로필 (Supabase auth.users 확장)
create table profiles (
  id uuid primary key references auth.users(id),
  email text,
  role text not null default 'customer',   -- customer | partner | admin
  name text,
  phone text,
  locale text default 'en',                 -- en | ko | ja | zh-TW
  created_at timestamptz default now()
);

-- 파트너 부가정보 (role='partner'인 프로필과 연결)
create table partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  company_name text,
  biz_no text,
  commission_rate numeric default 0.10,     -- 정산 수수료율
  settlement_info jsonb,                     -- 정산 계좌 등
  status text default 'pending',             -- pending | active | suspended
  created_at timestamptz default now()
);

-- 카테고리 (대/중 분류: parent_id 자기참조)
create table categories (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  parent_id uuid references categories(id), -- null이면 대분류
  name_i18n jsonb,                           -- {"en":"Apparel","ko":"의류"}
  sort_order int default 0,
  is_visible boolean default true
);

-- 상품 (실물/티켓/구독 통합 + 다국어)
create table products (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  seller_id uuid references profiles(id),    -- 자사 상품은 관리자 id
  is_partner_product boolean default false,
  product_type text default 'physical',      -- physical | ticket | subscription
  category_id uuid references categories(id),
  name_i18n jsonb,
  detail_html_i18n jsonb,                     -- 언어별 상세 HTML
  price int,
  currency text default 'USD',
  stock int default 0,
  attributes jsonb,                           -- 티켓 일시/좌석 등 타입별 속성
  ai_generated boolean default false,
  status text default 'draft',                -- draft | pending | active | soldout
  created_at timestamptz default now()
);

-- 주문 / 주문항목
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique,
  buyer_id uuid references profiles(id),
  status text default 'pending',              -- pending | paid | shipped | done | cancelled | refunded
  total_amount int,
  currency text default 'USD',
  payment_method text,
  created_at timestamptz default now()
);
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  product_id uuid references products(id),
  seller_id uuid references profiles(id),     -- 정산용(누가 판 상품인지)
  qty int,
  unit_price int,
  line_amount int
);

-- 배송 (국내/해외)
create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  region text default 'domestic',             -- domestic | overseas
  carrier text,
  tracking_no text,
  status text default 'preparing',
  shipped_at date,
  eta date,
  cost int default 0
);

-- 구독 (JNJ / DIV SaaS)
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  plan text,                                  -- JNJ | DIV (+ tier)
  status text default 'active',               -- active | paused | cancelled
  period_start date,
  period_end date,
  price int,
  currency text default 'USD'
);

-- 배너 / 게시판 / 메인섹션 / AI생성이력
create table banners (
  id uuid primary key default gen_random_uuid(),
  position text, title_i18n jsonb, image_url text, link_url text,
  sort_order int, start_at date, end_at date, is_active boolean default true
);
create table boards (
  id uuid primary key default gen_random_uuid(),
  board_type text, title text, content text,
  author_id uuid references profiles(id),
  status text default 'open', created_at timestamptz default now()
);
create table main_sections (
  id uuid primary key default gen_random_uuid(),
  section_type text,                          -- hero | slider | featured | category_strip
  config jsonb, sort_order int, is_active boolean default true
);
create table ai_product_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  input jsonb,                                -- 키워드/이미지 등
  generated_html text,
  status text default 'done', created_at timestamptz default now()
);
```

### RLS(권한) 메모
- **고객:** 자기 주문/구독만 조회.
- **파트너:** 자기 상품(`seller_id = auth.uid()`)·자기 정산 항목만 조회/수정.
- **관리자:** 전체 접근(별도 정책 또는 백엔드 service_role 키 사용).
- 적재/배치 스크립트는 **service_role 키**(절대 프런트·깃에 노출 금지)로.

```sql
-- 예: 파트너는 자기 상품만
create policy "partner_own_products" on products
  for all using (seller_id = auth.uid());
```

---

## 5. AI 상품페이지 생성 — 설계 메모

**흐름**
1. 입력 수집: 상품명 · 핵심 키워드 · 특징 3~5개 · 이미지 URL(들) · 카테고리
2. 백엔드(NestJS)에서 Claude API 호출 — **프런트에서 직접 호출 금지(키 노출)**
3. **고정 템플릿 프롬프트**로 구조화된 HTML 블록 생성 (제목/특징/이미지/상세설명 순서 통일)
4. 미리보기 → 사람이 확인/수정 → 저장 (`detail_html_i18n["en"]`)
5. 다른 언어는 "이 HTML을 ko/ja/zh-TW로 번역" 호출로 채움

**원칙**
- 디자인 일관성 위해 **템플릿(틀)을 먼저 고정**하고 내용만 채우게 한다.
- 생성 HTML은 저장·렌더링 양쪽에서 **sanitize**.
- 이미지는 HTML에 base64로 박지 말고 **Storage URL**만 삽입.
- 영어로 먼저 만들고 번역하는 방식이 품질·일관성에 유리.

---

## 6. 다국어(i18n) 전략

| 대상 | 방식 |
|---|---|
| UI 고정 텍스트(버튼·메뉴·안내문) | `next-intl` 등 + 언어별 JSON 파일 (DB 아님) |
| 상품·카테고리·배너 등 콘텐츠 | DB의 `*_i18n jsonb` 컬럼 (`{"en":..., "ko":...}`) |
| URL 구조 | `/en/...`, `/ko/...` 형태의 locale 라우팅 |

- 1차 오픈: **en + ko** 만. `ja`, `zh-TW`는 키만 비워두고 나중에 채움 → 구조는 처음부터 4개 언어 대비.
- 누락 언어는 기본 언어(en)로 폴백.

---

## 7. 공통 체크리스트 / 리스크

- [ ] 결제는 금액·통화·환불까지 한 세트로 검증 (가장 사고 잦은 영역)
- [ ] 파트너 정산 = `order_items.seller_id` + 수수료율로 계산 → 초기부터 데이터 정확히
- [ ] 상품 목록 쿼리에서 `detail_html` 빼기 (성능)
- [ ] AI 생성 HTML sanitize (XSS)
- [ ] 이미지 Storage 사용, row에 base64 금지
- [ ] service_role 키 노출 금지 (.env만)
- [ ] 다국어 구조를 처음부터 4개 언어 대비로 설계
- [ ] 티켓/구독은 실물상품과 결제·배송 로직이 다름 → 분기 처리

---

## 8. 지금 당장 할 것 (Next Action)

1. **Supabase 프로젝트 생성** → `auth` 확인.
2. 위 4번 SQL을 **Plan에서 결정한 내용 반영해 다듬은 뒤** 테이블 생성.
3. 카테고리·샘플 상품 2~3개 시드.
4. RLS 정책 적용하고, **파트너 계정으로 자기 상품만 보이는지** 확인.
5. 여기까지 되면 Phase 0 완료 → Phase 1(관리 페이지)로.

> 각 단계는 Claude Code에 "GUIDE.md의 Phase N, Do 항목 중 ○○을 만들어줘"로 하나씩 지시.
> 한 바퀴(Plan→Do→Check→Act) 다 돌고 다음으로 넘어갈 것. 한꺼번에 만들면 꼬인다.
