# wolf-app Planning Document

> **Summary**: 파트너 입점형 마켓플레이스 — 자사/파트너 상품 + 티켓 + SaaS 구독 + AI 상품페이지 생성 + 다국어를 갖춘 통합 커머스 플랫폼
>
> **Project**: wolf-app
> **Version**: 0.1.0
> **Author**: bandnara123
> **Date**: 2026-06-04
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 자사 상품·파트너 상품·티켓·SaaS 구독을 한 곳에서 팔아야 하는데, 상품 타입·판매자·배송·통화·언어가 제각각이라 일반 쇼핑몰 구조로는 설계가 무너진다. 게다가 파트너마다 상세페이지 품질이 들쭉날쭉하다. |
| **Solution** | Supabase(Postgres/Auth/Storage) + NestJS(결제·정산·AI) + Next.js 모노레포(web/admin) 기반으로, `product_type`·`seller_id`·`*_i18n`·`prices` 를 1급 개념으로 둔 데이터 모델을 먼저 세우고, Phase 0→4 PDCA 사이클로 한 단계씩 구축한다. AI가 상품 상세 HTML을 고정 템플릿으로 생성해 품질을 균일화한다. |
| **Function/UX Effect** | 운영자/파트너는 키워드만 넣으면 AI가 일관된 상세페이지를 만들고, 고객은 영어/한국어로 실물·티켓·구독을 한 장바구니에서 구매한다. 파트너 정산은 주문 데이터로 자동 산출된다. |
| **Core Value** | "AI 상품페이지 생성"이라는 차별점 위에 올린, 멀티-셀러·멀티-상품타입·멀티-통화·멀티-언어를 처음부터 견딜 수 있는 확장 가능한 커머스 코어. |

---

## Context Anchor

> Executive Summary·Requirements·Risk에서 자동 추출. Design/Do 문서로 전파되어 세션 간 맥락을 유지한다.

| Key | Value |
|-----|-------|
| **WHY** | 4가지(파트너 마켓플레이스 / 티켓 / SaaS 구독 / AI 상품페이지)가 합쳐진 플랫폼을, 다국어·다통화를 깔고도 흔들리지 않게 설계해야 한다. |
| **WHO** | 고객(일반 회원), 파트너(입점 판매자), 운영자(울프 어드민). 1차 시장은 해외(영어 우선) + 한국. |
| **RISK** | ① 결제/정산 금액·통화·환불 오류 ② AI 생성 HTML의 XSS/품질 ③ 상품 타입(실물/티켓/구독)별 결제·배송 분기 누락 ④ 다국어 구조를 뒤늦게 끼워넣는 비용. |
| **SUCCESS** | Phase 0: 스키마+RLS가 실제 Supabase에 생성되고 파트너가 자기 상품만 조회된다. 전체: 한 장바구니에서 실물+티켓+구독을 en/ko로 결제하고 파트너 정산이 자동 산출된다. |
| **SCOPE** | Phase 0(DB 설계, **이번 상세**) → 1(운영자 관리) → 2(메인) → 3(상품+AI) → 4(주문/결제/배송/구독/티켓/다국어 마감). |

---

## 1. Overview

### 1.1 Purpose

단순 쇼핑몰이 아니라 **4가지가 합쳐진 플랫폼**(파트너 입점형 마켓플레이스 + 티켓 판매 + JNJ/DIV SaaS 구독 + AI 상품페이지 생성)을, **영어 기본/한국어 + 추후 일어·대만어** 다국어를 전 영역에 깔고 구축한다. 이 문서는 전체 로드맵을 high-level로 고정하고, 가장 먼저 착수할 **Phase 0(DB 설계)**를 구현 가능한 수준으로 상세화한다.

### 1.2 Background

- 일반 쇼핑몰과 달리 상품에 **타입(`product_type`: physical/ticket/subscription)** 이 필요하고, 주문 항목마다 **판매자(seller)** 가 다를 수 있어 정산·수수료 개념이 필수다.
- 배송은 **국내/해외 2종**으로 분기되고, 모든 노출 텍스트는 **언어별**로 저장·분리돼야 한다.
- 결제는 **해외(Stripe) + 국내(PortOne)** 를 1차부터 함께 지원하므로, **통화별 가격을 각각 저장**(prices jsonb)하는 모델이 필요하다.
- 데이터 구조(Phase 0)가 먼저 서야 관리 화면(1)을 만들고, 관리 화면으로 데이터를 넣어야 메인(2)·상품(3)에 보여줄 게 생기며, 고객 결제/주문(4)은 보여줄 상품이 있어야 의미가 있다.

### 1.3 Related Documents

- 요구사항 원본: [설명.txt](../../../설명.txt)
- 구축 가이드: [쇼핑몰_구축가이드_PDCA.md](../../../쇼핑몰_구축가이드_PDCA.md)
- 통합관리 시트: `쇼핑몰_통합관리_시트.xlsx`
- 참조 인프라: 123pass-app 모노레포(apps/web + apps/admin + packages/) — 동일 구조 채택
- **디자인 시스템: `Design_System/`** (JNJ SCORE, Nike 영감 모노크롬) — 모든 UI가 준수

### 1.4 전역 요구사항 (설명.txt v2, 2026-06-04 추가)

| # | 요구 | 적용 범위 | 반영 |
|---|------|-----------|------|
| G-1 | **PC/모바일 반응형** — 양쪽 잘 동작 | 모든 UI(web/admin) | Tailwind `md:` 분기, 모바일 드로어/가로스크롤 |
| G-2 | **Design_System 준수** | 모든 UI | `Design_System/colors_and_type.css` 토큰을 Tailwind/globals로 이식, pill 버튼·Oswald·flat |

> 두 요구는 Phase 1(wolf-admin)부터 적용 시작. Phase 0(데이터 계층)은 UI 없어 무관.

---

## 2. Scope

### 2.1 In Scope

**이 문서(전체 로드맵 레벨):**
- [ ] 전체 5단계(Phase 0~4) 로드맵 및 산출물 정의
- [ ] 기술 스택·아키텍처 기본 방향 확정 (모노레포, Supabase+NestJS)
- [ ] 다국어(en/ko 1차, 4개 언어 대비)·다통화 전략 확정

**Phase 0 — DB 설계 (이번 상세):**
- [ ] 핵심 테이블 스키마 확정: profiles, partners, categories, products, orders, order_items, shipments, subscriptions, banners, boards, main_sections, ai_product_jobs
- [ ] 다국어 저장 방식: `*_i18n jsonb` 컬럼 (`{"en":..., "ko":...}`)
- [ ] 다통화 저장 방식: `prices jsonb` (`{"USD":..., "KRW":...}`) — 통화별 가격 각각 입력
- [ ] 상품 타입 통합: `product_type` (physical/ticket/subscription) 1테이블 + 타입별 속성은 `attributes jsonb`
- [ ] 판매자 구분: `seller_id` + `is_partner_product`
- [ ] RLS 정책(고객/파트너/관리자 권한 분리) 및 외래키 관계
- [ ] 시드 데이터(카테고리 + 샘플 상품 2~3개)
- [ ] 123Pass 연동 대비 인터페이스 컬럼(티켓 발권 외부 참조 필드) 자리만 확보

### 2.2 Out of Scope

- 이 문서에서 Phase 1~4의 화면·API 상세 설계 (각 Phase별 별도 `/pdca plan`으로 분리)
- 일어(ja)·대만어(zh-TW) 콘텐츠 실제 번역 (구조만 4개 언어 대비, 1차는 en/ko)
- 123Pass와의 실제 티켓 체크인 연동 구현 (1차는 독립 발권, 인터페이스만 대비)
- 실시간 환율 환산 (통화별 가격을 직접 입력하므로 환율 엔진 불필요)

---

## 3. Requirements

### 3.1 Functional Requirements

> 전체 로드맵 레벨 FR(상위) + Phase 0 상세 FR. Phase 1~4 상세 FR은 해당 Phase Plan에서 전개.

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-00 | 모노레포 구조(apps/web, apps/admin, packages/shared) 및 Supabase+NestJS 스캐폴딩 | High | Pending |
| FR-01 | profiles 테이블: role(customer/partner/admin) + locale + auth.users 연동 | High | Pending |
| FR-02 | partners 테이블: 입점 판매자 부가정보 + commission_rate + status(pending/active/suspended) | High | Pending |
| FR-03 | categories 테이블: parent_id 자기참조(대/중 분류) + name_i18n + sort_order/is_visible | High | Pending |
| FR-04 | products 테이블: product_type, seller_id, is_partner_product, name_i18n, detail_html_i18n, prices(jsonb 통화별), attributes(jsonb), ai_generated, status | High | Pending |
| FR-05 | orders / order_items: order_items.seller_id로 판매자별 분리(정산 근거), 다통화 currency | High | Pending |
| FR-06 | shipments 테이블: region(domestic/overseas) 분기 + carrier/tracking_no/status | High | Pending |
| FR-07 | subscriptions 테이블: plan(JNJ/DIV), status, period_start/end (반복결제 모델) | Medium | Pending |
| FR-08 | banners / boards / main_sections / ai_product_jobs 독립 관리 테이블 | Medium | Pending |
| FR-09 | RLS 정책: 고객(자기 주문/구독), 파트너(자기 상품/정산), 관리자(전체) | High | Pending |
| FR-10 | 시드 데이터(카테고리 + 샘플 상품) 및 schema.sql 버전 관리 | Medium | Pending |
| FR-11 | 티켓 발권 외부 참조 필드(123Pass 연동 대비) 스키마 자리 확보 | Low | Pending |
| FR-R1 | (로드맵) Phase 1 운영자 관리 페이지 — 회원/파트너/상품/카테고리/주문/배송/게시판/배너/메인 CRUD | High | Pending |
| FR-R2 | (로드맵) Phase 2 메인페이지 — main_sections 기반 렌더링 + 배너 노출기간 | High | Pending |
| FR-R3 | (로드맵) Phase 3 상품페이지 + AI 생성(영어 생성→번역) + sanitize | High | Pending |
| FR-R4 | (로드맵) Phase 4 주문/결제(Stripe+PortOne)/배송/구독/티켓/다국어 마감 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Security | RLS로 파트너는 자기 상품만 접근, service_role 키는 서버에만(.env) | RLS 정책 테스트 + 키 노출 grep |
| Security | AI 생성 HTML XSS 방지 sanitize (isomorphic-dompurify) | 렌더/저장 양쪽 sanitize 검증 |
| Performance | 상품 목록 쿼리에서 detail_html 제외 | 쿼리 select 컬럼 검수 |
| Data Integrity | 결제 금액·통화·환불 정합성, orphan row 없음 | 외래키 제약 + 결제 시나리오 테스트 |
| i18n | 누락 언어는 기본 언어(en) 폴백, 구조는 4개 언어 대비 | i18n 헬퍼 단위 테스트 |
| Storage | 이미지는 Storage URL 사용, row에 base64 금지 | 상세 HTML 내 img src 검사 |

---

## 4. Success Criteria

### 4.1 Definition of Done

**Phase 0 (이번 단계):**
- [ ] §7.4의 모든 핵심 테이블이 실제 Supabase에 생성됨
- [ ] 외래키(관계) 연결 완료, orphan row 없음
- [ ] RLS 정책 적용 — **파트너 계정으로 자기 상품만 보임** (핵심 검증)
- [ ] 관리자 계정으로 전체 테이블 조회 가능
- [ ] 시드 데이터(카테고리 + 샘플 상품 2~3개) 적재
- [ ] 확정 스키마를 `schema.sql`로 저장(버전 관리)

**전체 프로젝트:**
- [ ] 한 장바구니에서 실물+티켓+구독을 en/ko로 결제(Stripe/PortOne) 가능
- [ ] order_items.seller_id 기반 파트너 정산 금액 자동 산출
- [ ] AI 상품페이지 생성이 일관된 템플릿으로 동작 + sanitize

### 4.2 Quality Criteria

- [ ] 다통화 가격이 prices jsonb로 통화별 정확히 저장/조회
- [ ] 다국어 텍스트가 *_i18n에서 현재 locale로 정확히 출력 + 폴백
- [ ] Lint/Build 통과, 스키마 마이그레이션 재현 가능(idempotent)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 결제 금액·통화·환불 오류 (가장 사고 잦은 영역) | High | Medium | 금액·통화·환불을 한 세트로 검증, 통화별 가격 직접 저장(환율 변수 제거), 결제 시나리오 테스트 우선 |
| AI 생성 HTML XSS / 품질 들쭉날쭉 | High | Medium | 고정 템플릿 프롬프트로 구조 통일, 저장·렌더 양쪽 sanitize, 이미지는 Storage URL만 |
| 상품 타입별(실물/티켓/구독) 결제·배송 분기 누락 | High | Medium | product_type을 1급 개념으로 두고 attributes jsonb로 타입별 속성 분리, 분기 로직 명시 |
| 다국어 구조를 뒤늦게 끼워넣음 | Medium | Low | Phase 0부터 *_i18n 구조를 4개 언어 대비로 설계, UI는 next-intl |
| service_role 키 노출 | High | Low | 키는 서버(.env)에만, 프런트·git 노출 금지, 적재 스크립트도 service_role로만 |
| 모노레포 초기 셋업 복잡도 | Medium | Medium | 123pass-app 동일 패턴 재사용으로 학습비용 절감 |
| 123Pass 티켓 연동 범위 모호 | Low | Medium | 1차 독립 발권, 외부 참조 필드만 스키마에 확보해 나중에 연결 |

---

## 6. Impact Analysis

> 신규 프로젝트(green-field)이므로 기존 소비자 영향은 제한적. 단 모노레포·인프라 결정이 후속 Phase 전체에 파급된다.

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| Supabase 스키마 (12개 테이블) | DB Model | 신규 생성 — Phase 1~4의 모든 화면/API가 이 스키마에 의존 |
| 모노레포 구조 | Config | apps/web, apps/admin, packages/shared 신규 — 이후 모든 코드 위치 규약 |
| prices jsonb / *_i18n jsonb 규약 | Schema | 통화·언어 저장 방식 — 모든 콘텐츠 읽기/쓰기 경로에 파급 |

### 6.2 Current Consumers

신규 프로젝트라 기존 소비자는 없음. 단 **이 스키마가 만들어내는 미래 소비자**를 미리 인지:

| Resource | Operation | Code Path (예정) | Impact |
|----------|-----------|-----------|--------|
| products | READ | web/상품목록(detail_html 제외), 상품상세(detail_html_i18n 포함) | Phase 2/3에서 생성 |
| products | CREATE/UPDATE | admin/상품관리, AI 생성(ai_product_jobs→products) | Phase 1/3 |
| order_items.seller_id | READ | 파트너 정산 계산 | Phase 4 |
| *_i18n / prices | READ | 전 영역 콘텐츠/가격 출력 | 전 Phase |

### 6.3 Verification

- [ ] 스키마가 Phase 1~4 요구를 견디는지 가이드 §4와 대조
- [ ] RLS가 권한 경계(고객/파트너/관리자)를 깨지 않는지 확인
- [ ] prices/*_i18n 폴백·누락 처리 규약 합의

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | 단순 구조 | 정적 사이트, 포트폴리오 | ☐ |
| **Dynamic** | Feature 모듈, 백엔드 연동, 모노레포 | 백엔드 있는 웹앱, SaaS, 풀스택 | ☑ |
| **Enterprise** | 엄격한 레이어 분리, DI, MSA | 초대형/복잡 아키텍처 | ☐ |

> **선택: Dynamic.** 단, 결제·정산·AI 등 민감 로직은 NestJS로 분리해 Dynamic+ 형태.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Frontend | Next.js / React / Vue | **Next.js (App Router)** | SSR로 상품/메인 SEO 확보, locale 라우팅(/en, /ko) |
| App 구조 | 단일앱 role라우팅 / **모노레포 web+admin** | **모노레포 (apps/web + apps/admin)** | 고객/관리자 번들 분리, 123pass-app과 동일 패턴, packages/로 SDK·타입 공유 |
| Backend | BaaS / **Custom(NestJS)** / Serverless | **Supabase + NestJS** | Supabase=DB/Auth/Storage, NestJS=결제·정산·AI 호출 등 민감/복합 로직 |
| DB / Auth / Storage | — | **Supabase (Postgres)** | RLS로 멀티-셀러 권한 분리, auth 내장 |
| 결제 | PortOne / Stripe / 둘 다 | **Stripe(해외) + PortOne(국내)** | 해외 우선 + 국내 동시. PG 추상화 레이어(PaymentProvider 인터페이스)로 분기 |
| 다통화 | 단일통화환산 / **통화별 직접입력** | **prices jsonb (USD/KRW…)** | 환율 변동 무관, 가격 정책 자유 |
| 다국어 | DB i18n / 파일 | **혼합** | UI 고정 텍스트=next-intl(JSON), 콘텐츠=DB `*_i18n jsonb` |
| AI 생성 | — | **NestJS에서 Claude API 호출** | 프런트 키 노출 금지, 고정 템플릿, 영어 생성→번역 |
| State Management | Context / Zustand / react-query | **react-query(서버상태) + Zustand(클라)** | 후속 Design에서 확정 |
| Styling | Tailwind / CSS Modules | **Tailwind** | 123pass-app 일관성(후속 확정) |

### 7.3 Clean Architecture Approach

```
Selected Level: Dynamic (모노레포 + NestJS 분리)

Folder Structure Preview:
┌─────────────────────────────────────────────────────┐
│ wolf-app/ (monorepo)                                │
│   apps/                                             │
│     web/      → 고객 쇼핑몰 (Next.js, /en /ko)       │
│     admin/    → 운영자 관리 (Next.js, role=admin)    │
│     api/      → NestJS (결제·정산·AI·민감로직)        │
│   packages/                                         │
│     shared/   → 공유 타입, i18n 헬퍼, prices 헬퍼     │
│     supabase/ → 스키마, 마이그레이션, RLS, seed       │
│   .env (service_role 키 — git 제외)                  │
└─────────────────────────────────────────────────────┘
```

### 7.4 Phase 0 데이터 모델 (상세)

> 출발점은 가이드 §4. Plan 결정사항(통화별 prices jsonb, 123Pass 대비 필드)을 반영.

```sql
-- profiles: auth.users 확장
profiles(id, email, role[customer|partner|admin], name, phone,
         locale[en|ko|ja|zh-TW] default 'en', created_at)

-- partners: role='partner' 부가정보
partners(id, user_id→profiles, company_name, biz_no,
         commission_rate default 0.10, settlement_info jsonb,
         status[pending|active|suspended], created_at)

-- categories: 대/중 분류 자기참조
categories(id, code unique, parent_id→categories, name_i18n jsonb,
           sort_order, is_visible)

-- products: 실물/티켓/구독 통합 + 다국어 + 다통화
products(id, code unique, seller_id→profiles, is_partner_product,
         product_type[physical|ticket|subscription], category_id→categories,
         name_i18n jsonb, detail_html_i18n jsonb,
         prices jsonb,            -- {"USD":1990,"KRW":2900000} (통화별 직접 입력)
         attributes jsonb,        -- 티켓 일시/좌석, 구독 tier 등 타입별 속성
         external_ref jsonb,      -- 123Pass 연동 대비(발권 외부 참조) 자리
         ai_generated, status[draft|pending|active|soldout], created_at)

-- orders / order_items
orders(id, order_no unique, buyer_id→profiles,
       status[pending|paid|shipped|done|cancelled|refunded],
       total_amount, currency, payment_method[stripe|portone], created_at)
order_items(id, order_id→orders, product_id→products,
            seller_id→profiles,  -- 정산용(누가 판 상품인지)
            qty, unit_price, line_amount, currency)

-- shipments: 국내/해외 분기
shipments(id, order_id→orders, region[domestic|overseas],
          carrier, tracking_no, status[preparing|shipped|delivered],
          shipped_at, eta, cost)

-- subscriptions: JNJ/DIV
subscriptions(id, user_id→profiles, plan[JNJ|DIV(+tier)],
              status[active|paused|cancelled], period_start, period_end,
              price, currency)

-- 독립 관리 테이블
banners(id, position, title_i18n jsonb, image_url, link_url,
        sort_order, start_at, end_at, is_active)
boards(id, board_type[notice|qna|review|faq], title, content,
       author_id→profiles, status, created_at)
main_sections(id, section_type[hero|slider|featured|category_strip],
              config jsonb, sort_order, is_active)
ai_product_jobs(id, product_id→products, input jsonb, generated_html,
                status, created_at)
```

**RLS 핵심:**
- 고객: 자기 주문/구독만 (`buyer_id = auth.uid()`)
- 파트너: 자기 상품/정산만 (`seller_id = auth.uid()`)
- 관리자: 전체 (별도 정책 또는 service_role)

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [ ] `CLAUDE.md` 코딩 컨벤션 섹션 (신규 작성 필요)
- [ ] `docs/01-plan/conventions.md` (Phase 2 산출물 — 예정)
- [ ] ESLint / Prettier / tsconfig (모노레포 셋업 시 생성)
- [x] 참조: 123pass-app 컨벤션 (가능하면 정렬)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | missing | 테이블 snake_case, i18n 컬럼 `_i18n` 접미사, 가격 `prices` jsonb | High |
| **Folder structure** | missing | 모노레포 apps/packages 규약 (§7.3) | High |
| **i18n 키 규약** | missing | UI는 next-intl 네임스페이스, 콘텐츠는 `*_i18n` | High |
| **통화/금액 단위** | missing | 정수 최소단위 저장 규약(센트/원), prices jsonb 키=ISO 통화코드 | High |
| **Environment variables** | missing | §8.3 목록 | High |
| **Error handling** | missing | 결제/AI 호출 에러 패턴 | Medium |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | Client | ☐ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 | Client | ☐ |
| `SUPABASE_SERVICE_ROLE_KEY` | 적재/배치/서버 전용 (절대 노출 금지) | Server | ☐ |
| `ANTHROPIC_API_KEY` | AI 상품페이지 생성 (Claude API) | Server(NestJS) | ☐ |
| `STRIPE_SECRET_KEY` | 해외 결제 | Server | ☐ |
| `PORTONE_API_SECRET` | 국내 결제 | Server | ☐ |

### 8.4 Pipeline Integration

| Phase | Status | Document Location | Command |
|-------|:------:|-------------------|---------|
| Phase 1 (Schema) | ☐ | `docs/01-plan/schema.md` | `/pipeline-next` |
| Phase 2 (Convention) | ☐ | `docs/01-plan/conventions.md` | `/pipeline-next` |

---

## 9. Next Steps

1. [ ] **이 Plan 검토·승인** (요구사항/스택/범위 확정 여부)
2. [ ] `/pdca design wolf-app` — Phase 0 DB 설계를 3가지 아키텍처 옵션으로 상세화
3. [ ] (또는) `/bkit:phase-1-schema` — 스키마 단독 정의로 진행
4. [ ] Supabase 프로젝트 생성 + 모노레포 스캐폴딩
5. [ ] Phase 0 완료 후 → Phase 1(운영자 관리 페이지) Plan 분리 작성

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-04 | 초안 — 전체 로드맵 + Phase 0 상세, 핵심 결정(모노레포/Supabase+NestJS/Stripe+PortOne/통화별 prices/AI 영어생성→번역) 반영 | bandnara123 |
