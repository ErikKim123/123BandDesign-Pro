# wolf-admin Design Document

> **Summary**: 운영자 백오피스(apps/admin) — config-driven CRUD 기반. 공통 DataTable/Form/훅 + 리소스 설정으로 회원/파트너/상품/카테고리 구현 (Option C)
>
> **Project**: wolf-app / apps/admin
> **Version**: 0.1.0
> **Author**: bandnara123
> **Date**: 2026-06-04
> **Status**: Draft
> **Planning Doc**: [wolf-admin.plan.md](../../01-plan/features/wolf-admin.plan.md)

### Pipeline References

| Phase | Document | Status |
|-------|----------|--------|
| Phase 0 | [wolf-app.design.md](wolf-app.design.md) (스키마·RLS) | ✅ 완료(Runtime 검증 99%) |
| Phase 2 (Convention) | apps/admin 컨벤션 | 이 문서에서 정의 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | DB만으로는 운영 불가 — 데이터를 넣고 파트너/상품을 관리할 백오피스가 있어야 Phase 2~4가 의미를 가진다. |
| **WHO** | 운영자(role=admin). 1차는 DB에서 수동 지정한 소수. |
| **RISK** | ① 권한 경계(비-admin 차단) ② 다국어·다통화 입력 UX ③ 파트너/상품 상태 전이 오류 ④ 9화면 중복 구현 불일치. |
| **SUCCESS** | admin 로그인 후 회원/파트너/상품/카테고리 목록·검색·편집·저장, 비-admin 차단, 파트너 승인 흐름 동작. |
| **SCOPE** | 공통기반 + 회원/파트너/상품/카테고리(이번) → 주문/배송/게시판/배너/메인(후속). |

---

## Design Anchor (Design_System 준수)

> 출처: `Design_System/colors_and_type.css` (JNJ SCORE — Nike 영감 모노크롬). 설명.txt 요구 7 반영.

| Category | Tokens |
|----------|--------|
| **Colors** | 모노크롬: black `#111111`, white, grey 50~900. 시맨틱만 색 — danger `#D30005`, success `#007D48`, info `#1151FF`, live `#FF5000` |
| **Typography** | Display=Oswald(대문자 헤드라인), Body=Helvetica 스택. 라벨/배지 ALL CAPS 12px tight |
| **Spacing** | 8px 그리드 (4·8·12·16·24·48·64·80) |
| **Radius** | 버튼·필터 **pill 30px**, 인풋 8px, 컨테이너 20px, 이미지 0px |
| **Elevation** | radically flat — 그림자 없음. divider 1px inset + focus ring만 |
| **Tone** | 직설적·물리적. 이모지/느낌표 금지. Lucide 아이콘(1.5px stroke) |
| **Layout** | sticky 흰 nav ~60px, max 1440px |

> 구현: `apps/admin/tailwind.config.ts`(토큰) + `globals.css`(.btn/.input/.label-caps + Oswald import). web(Phase 2+)도 동일 토큰 공유 예정.

### 반응형 요구 (설명.txt 요구 6)

| Breakpoint | 처리 |
|-----------|------|
| 모바일(<768px) | 사이드바 = 드로어(햄버거), 상단바 노출, 필터/그리드 1열, 테이블 가로 스크롤 |
| PC(≥768px) | 사이드바 고정(w-64), 콘텐츠 영역 분리, 필터 인라인 |

> 모든 화면은 PC/모바일 양쪽 동작 필수. Tailwind `md:` 분기로 처리.

---

## 1. Overview

### 1.1 Design Goals

1. **9화면을 찍어내는 공통 기반**: DataTable + Form + 데이터 훅을 한 번 만들고, 화면은 "리소스 설정 객체"로 선언
2. **권한 이중 방어**: 미들웨어(라우트) + RLS(`is_admin()`, Phase 0)
3. **다국어·다통화 입력 캡슐화**: I18nField(en/ko), PriceField(USD/KRW)
4. **상태 머신 안전성**: 파트너/상품 상태 전이를 허용 전이만 노출

### 1.2 Design Principles

- **Option C (Config-driven)**: 리소스마다 `ResourceConfig` 선언 → 제네릭 `ResourceListPage`/`ResourceFormPage`가 소비. 공통은 추상화, 예외(상품·카테고리)는 커스텀 슬롯.
- **anon + RLS만**: Phase 1은 프런트 단독. service_role 미사용.
- **@wolf/shared 재사용**: 타입(Product/Partner…), pickI18n/pickPrice, createBrowserClient.
- **YAGNI**: repository/DI 같은 레이어는 도입하지 않음(9화면엔 config로 충분).

---

## 2. Architecture Options (v1.7.0)

### 2.0 Architecture Comparison

| Criteria | A: Minimal | B: Clean(레이어) | C: Pragmatic(config-driven) |
|----------|:-:|:-:|:-:|
| 접근 | 화면별 직접 | repository/service+DI | 공통 + 리소스 설정 |
| New Files | ~18 | ~40 | ~28 |
| 9화면 확장 | 중복 폭증 | 최강 | 강함(설정 추가) |
| Complexity | Low | High | Medium |
| Maintainability | Low | High | High |
| Effort | Low→High(누적) | High | Medium |
| Recommendation | PoC | 초대형 | **선택됨** |

**Selected**: **Option C** — **Rationale**: 9화면 일관 확장 + 1차 속도 균형. 리소스 설정 객체로 회원/파트너/상품/카테고리를 선언하고 제네릭 페이지가 소비. 상품/카테고리는 커스텀 슬롯으로 단순 CRUD 한계를 보완.

### 2.1 Component Diagram

```
apps/admin (Next.js App Router, anon key)
┌──────────────────────────────────────────────┐
│ middleware.ts ── 세션/role=admin 라우트 가드   │
├──────────────────────────────────────────────┤
│ (dashboard)/layout.tsx ── 사이드바 + 서버 가드  │
│   members/   partners/   products/  categories/│
│      │          │           │          │        │
│      ▼          ▼           ▼          ▼        │
│   ResourceListPage / ResourceFormPage (제네릭)  │
│      └─ consumes ResourceConfig (리소스별 설정)  │
├──────────────────────────────────────────────┤
│ components: DataTable, I18nField, PriceField,  │
│             StatusBadge, FormField (shadcn/ui)  │
│ lib/queries: useResourceList/Detail/Mutation    │
│ lib/supabase: createBrowserClient (@wolf/shared)│
└───────────────────┬──────────────────────────┘
                    │ anon key + RLS is_admin()
                    ▼
              Supabase (Phase 0 스키마)
```

### 2.2 Data Flow

```
페이지 진입 → middleware(세션 체크) → layout(role=admin 가드)
→ ResourceConfig 로드 → useResourceList(react-query) → Supabase select(RLS)
→ DataTable 렌더 → 행 클릭 → ResourceFormPage → 수정 → useMutation → invalidate
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| ResourceListPage/FormPage | ResourceConfig, lib/queries, DataTable/Form | 제네릭 CRUD |
| lib/queries | @wolf/shared(createBrowserClient, 타입) | 데이터 접근 |
| middleware + layout guard | Supabase Auth, profiles.role | 인가 |
| I18nField/PriceField | @wolf/shared(I18n/Prices, pickI18n/pickPrice) | 다국어·다통화 입력 |

---

## 3. Data Model

> 신규 테이블 없음. Phase 0 스키마 사용. admin은 다음 테이블을 읽기/쓰기:
> profiles, partners, products, categories. (RLS admin 정책 경유)

### 3.1 ResourceConfig (프런트 도메인 타입)

```typescript
// apps/admin/src/lib/resource/types.ts
import type { ColumnDef } from '@tanstack/react-table';

export interface FieldDef {
  name: string;
  label: string;
  kind: 'text' | 'number' | 'select' | 'toggle' | 'i18n' | 'prices' | 'custom';
  options?: { value: string; label: string }[]; // select
  required?: boolean;
  readOnly?: boolean;
}

export interface ResourceConfig<T> {
  key: string;                  // 'members' | 'partners' | 'products' | 'categories'
  table: string;                // supabase 테이블명
  title: string;
  listColumns: ColumnDef<T>[];  // DataTable 컬럼
  filters: FieldDef[];          // 목록 검색/필터
  formFields: FieldDef[];       // 상세/편집 폼
  defaultSort?: { column: string; asc: boolean };
  selectColumns?: string;       // 목록 select (products는 detail_html 제외)
  searchColumns?: string[];     // ilike 검색 대상
}
```

### 3.2 상태 머신 (허용 전이)

```
partners.status:  pending → active → suspended → active   (반려: pending → suspended)
products.status:  draft → pending → active → soldout       (active ↔ soldout)
orders.status:    (Phase 4) pending → paid → shipped → done / cancelled / refunded
```

> 허용 전이만 UI에 노출(StatusBadge + 액션 버튼). 임의 전이 차단.

---

## 4. API Specification

> **별도 API 서버 없음.** apps/admin은 Supabase anon 클라이언트로 직접 접근, RLS `is_admin()`이 권한 강제. 데이터 접근은 react-query 훅으로 캡슐화.

### 4.1 데이터 접근 훅 (lib/queries)

| 훅 | 동작 | RLS |
|----|------|-----|
| `useResourceList(config, params)` | `from(table).select(selectColumns).ilike(...).order().range()` | admin 전체 |
| `useResourceDetail(config, id)` | `from(table).select('*').eq('id', id).single()` | admin 전체 |
| `useResourceUpsert(config)` | `from(table).upsert(values)` | admin write 정책 |
| `usePartnerTransition(id, next)` | `from('partners').update({status: next})` | admin |
| `useProductTransition(id, next)` | `from('products').update({status: next})` | admin |

### 4.2 인증/인가

```
middleware.ts:
  - 세션 없음 → /login 리다이렉트
  - 세션 있음 → 통과 (role 체크는 layout 서버 컴포넌트에서)

(dashboard)/layout.tsx (서버 컴포넌트):
  - supabase.auth.getUser() → profiles.role 조회
  - role !== 'admin' → /login?error=forbidden 리다이렉트
  - admin → 사이드바 + children 렌더
```

> 이중 방어: 프런트 가드(UX) + RLS(실제 데이터 차단). 가드가 뚫려도 RLS가 비-admin 데이터를 막음.

---

## 5. UI/UX Design

### 5.1 Screen Layout

```
┌───────────┬────────────────────────────────────┐
│ Sidebar    │  Header (현재 메뉴 / 사용자)         │
│  회원      ├────────────────────────────────────┤
│  파트너    │  [검색·필터 바]            [+ 추가]   │
│  상품      │  ┌──────────────────────────────┐  │
│  카테고리  │  │ DataTable (정렬·페이지네이션)  │  │
│  ─────     │  └──────────────────────────────┘  │
│  (주문…)   │  행 클릭 → Drawer/Page 폼            │
└───────────┴────────────────────────────────────┘
```

### 5.2 User Flow

```
로그인 → (admin 확인) → 대시보드 → 메뉴 선택 → 목록(검색/필터)
→ 행 클릭(상세/편집) 또는 +추가 → 폼 입력 → 저장 → 목록 갱신
파트너: 목록 → 승인/반려 버튼 → 상태 전이
```

### 5.3 Component List

| Component | Location | 책임 |
|-----------|----------|------|
| AdminSidebar | components/layout/ | 9메뉴 네비 |
| DataTable | components/data-table/ | 정렬·필터·페이지네이션(@tanstack/react-table) |
| ResourceListPage | components/resource/ | config 소비, 목록 |
| ResourceFormPage | components/resource/ | config 소비, 폼(react-hook-form) |
| I18nField | components/form/ | en/ko 탭 입력 |
| PriceField | components/form/ | USD/KRW 정수 입력 |
| StatusBadge | components/form/ | 상태 + 허용 전이 버튼 |
| CategoryTree | components/categories/ | 대/중 트리(커스텀 슬롯) |

### 5.4 Page UI Checklist

#### 로그인 (/login)
- [ ] Input: 이메일 / 비밀번호
- [ ] Button: 로그인
- [ ] Error: 인증 실패 / 권한 없음(forbidden) 메시지

#### 회원관리 (/members)
- [ ] Filter: role 셀렉트(customer/partner/admin)
- [ ] Filter: locale 셀렉트(en/ko/ja/zh-TW)
- [ ] Search: 이메일/이름 (ilike)
- [ ] Table: email, role(badge), name, locale, created_at
- [ ] Form: name, phone, role(select), locale(select)

#### 파트너관리 (/partners)
- [ ] Filter: status(pending/active/suspended)
- [ ] Table: company_name, biz_no, commission_rate, status(badge)
- [ ] Action: 승인(pending→active) / 반려(pending→suspended) / 정지(active→suspended) / 복구
- [ ] Form: company_name, biz_no, commission_rate(0~1)

#### 상품관리 (/products)
- [ ] Filter: product_type, status, is_partner_product, category
- [ ] Search: code / name_i18n
- [ ] Table: name(현재 locale), type, seller(자사/파트너), prices(USD/KRW), status(badge) — **detail_html 제외**
- [ ] Form: code, name_i18n(en/ko), category(select), product_type, prices(USD/KRW), attributes(JSON), status(승인 전이)
- [ ] Custom: detail_html_i18n textarea (리치에디터/AI는 Phase 3)

#### 카테고리관리 (/categories)
- [ ] Tree: 대분류 → 중분류(parent_id)
- [ ] Form: code, name_i18n(en/ko), parent(select, null=대분류), sort_order, is_visible(toggle)
- [ ] Action: 노출순서 변경

---

## 6. Error Handling

| 상황 | 처리 |
|------|------|
| 미인증 접근 | middleware → /login |
| 비-admin 접근 | layout 가드 → /login?error=forbidden + RLS 0행 |
| RLS 거부/0행 | "권한이 없거나 데이터가 없습니다" 구분 표시 |
| 폼 검증 실패 | react-hook-form 필드 에러 + zod 스키마 |
| 잘못된 상태 전이 | 허용 전이만 버튼 노출(원천 차단) |
| Supabase 에러 | react-query onError → 토스트 |

---

## 7. Security Considerations

- [ ] 미들웨어 + 서버 컴포넌트 가드(role=admin) 이중
- [ ] RLS `is_admin()`로 데이터 레벨 차단 (가드 우회 대비)
- [ ] service_role 키 미사용(anon만) → 클라이언트 키 노출면 최소
- [ ] 폼 입력 zod 검증(commission_rate 0~1, prices 정수, status enum)
- [ ] attributes JSON 입력 파싱 검증(잘못된 JSON 거부)
- [ ] XSS: detail_html은 admin 입력만 저장(렌더 sanitize는 web/Phase 3)

---

## 8. Test Plan (v2.3.0)

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: 데이터 훅/RLS | admin select/upsert가 RLS 경유 동작 | Node(pg)+supabase-js | Do |
| L2: UI Action | 로그인 가드, 목록 필터, 폼 저장, 승인 전이 | Playwright | Do |
| L3: E2E | 로그인→파트너 승인→상품 등록→목록 확인 | Playwright | Do |

### 8.2 L1 시나리오

| # | 대상 | 기대 |
|---|------|------|
| 1 | admin 세션으로 partners select | 전체 반환 |
| 2 | 비-admin 세션으로 /members 데이터 | 0행(RLS) |
| 3 | partner status pending→active upsert | 반영 |
| 4 | product upsert (prices USD/KRW, name_i18n) | jsonb 저장 |
| 5 | 목록 select에 detail_html 미포함 | 컬럼 부재 확인 |

### 8.3 L2 시나리오

| # | Page | Action | Expected |
|---|------|--------|----------|
| 1 | /login | 비-admin 로그인 | forbidden, 대시보드 진입 차단 |
| 2 | /partners | 승인 버튼 클릭 | status=active, badge 변경 |
| 3 | /products | +추가 → 폼 저장 | 목록에 신규 행 |
| 4 | /products | 잘못된 attributes JSON | 검증 에러 |
| 5 | /categories | 중분류 추가 | 트리에 표시 |

### 8.4 L3 시나리오

| # | Scenario | Steps |
|---|----------|-------|
| 1 | 입점→판매 준비 | 로그인 → 파트너 승인 → 카테고리 생성 → 상품 등록(active) → 목록 확인 |
| 2 | 권한 차단 | 비-admin 로그인 → /products 접근 → 차단 확인 |

### 8.5 Seed Data
Phase 0 seed 재사용(admin/partner/customer + 카테고리 + 상품 3종). admin 계정 비밀번호는 Supabase Auth에서 설정 필요(seed의 auth.users는 비번 없음 → 테스트 시 비번 설정 또는 magic link).

---

## 9. Clean Architecture

### 9.1 Layer Structure

| Layer | 책임 | Location |
|-------|------|----------|
| Presentation | 페이지, 레이아웃, 컴포넌트 | `apps/admin/src/app/`, `src/components/` |
| Application | 리소스 설정, 데이터 훅, 상태 전이 | `src/lib/resource/`, `src/lib/queries/` |
| Domain | 공통 타입·헬퍼 | `@wolf/shared` (재사용) |
| Infrastructure | Supabase 클라이언트 | `@wolf/shared/supabase` (재사용) |

### 9.4 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| ResourceConfig(members/partners/products/categories) | Application | `src/lib/resource/configs/*.ts` |
| useResourceList/Detail/Upsert | Application | `src/lib/queries/resource.ts` |
| DataTable/I18nField/PriceField | Presentation | `src/components/` |
| 페이지 | Presentation | `src/app/(dashboard)/*/page.tsx` |
| 타입/헬퍼/클라이언트 | Domain/Infra | `@wolf/shared` |

---

## 10. Coding Convention Reference

### 10.1 Naming

| Target | Rule | Example |
|--------|------|---------|
| 컴포넌트 | PascalCase | `DataTable`, `I18nField` |
| 훅 | use+camelCase | `useResourceList`, `usePartnerTransition` |
| 리소스 설정 | `{resource}Config` | `productsConfig` |
| 폴더 | kebab-case | `data-table/`, `resource/` |

### 10.3 환경변수 (apps/admin/.env.local)

| Variable | Scope |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client |

### 10.4 This Feature's Conventions

| Item | Convention |
|------|-----------|
| 데이터 접근 | react-query 훅만 사용(컴포넌트서 직접 supabase 호출 금지) |
| 다국어 입력 | I18nField(en/ko), 저장 시 빈 값 제외 |
| 금액 | PriceField, 최소단위 정수, prices jsonb |
| 권한 | 미들웨어+layout 가드, 컴포넌트선 신뢰 안 함 |
| 상태 전이 | 허용 전이만 버튼 노출 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
apps/admin/
├── components.json              # shadcn/ui
├── next.config.js / tailwind.config.ts / tsconfig.json
├── .env.local
├── src/
│   ├── middleware.ts            # 세션 가드
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx       # role=admin 가드 + 사이드바
│   │       ├── members/page.tsx
│   │       ├── partners/page.tsx
│   │       ├── products/page.tsx
│   │       └── categories/page.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn
│   │   ├── layout/AdminSidebar.tsx
│   │   ├── data-table/DataTable.tsx
│   │   ├── form/{I18nField,PriceField,StatusBadge}.tsx
│   │   ├── resource/{ResourceListPage,ResourceFormPage}.tsx
│   │   └── categories/CategoryTree.tsx
│   └── lib/
│       ├── supabase/client.ts   # @wolf/shared 래핑 + 세션
│       ├── resource/{types.ts, configs/*.ts}
│       └── queries/resource.ts
```

### 11.2 Implementation Order

1. [ ] apps/admin 초기화(Next.js+Tailwind+shadcn/ui+react-query) + @wolf/shared 연동
2. [ ] 인증: 로그인 + middleware + layout 가드
3. [ ] 공통 컴포넌트: DataTable, I18nField, PriceField, StatusBadge
4. [ ] ResourceConfig 타입 + 제네릭 ListPage/FormPage + 데이터 훅
5. [ ] 회원 → 파트너(승인 전이) → 상품(커스텀) → 카테고리(트리) 설정·화면
6. [ ] L1/L2/L3 테스트

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Turns |
|--------|-----------|-------------|:-----:|
| 앱 초기화 + 인증 게이트 | `module-1` | Next.js/Tailwind/shadcn/react-query 셋업, 로그인, middleware+layout 가드 | 15-20 |
| 공통 컴포넌트 + 리소스 엔진 | `module-2` | DataTable, I18nField/PriceField/StatusBadge, ResourceConfig+제네릭 페이지+훅 | 20-25 |
| 회원 + 파트너 화면 | `module-3` | members 설정 + partners 설정·승인 전이 | 15-20 |
| 상품 + 카테고리 화면 | `module-4` | products(커스텀 슬롯) + categories(트리) + L1~L3 테스트 | 20-25 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| 1 | Plan + Design | 전체 | 완료 |
| 2 | Do | `--scope module-1,module-2` | 45-55 |
| 3 | Do | `--scope module-3,module-4` | 45-55 |
| 4 | Check + Report | 전체 | 30-40 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-04 | 초안 — config-driven 어드민(Option C): 인증 게이트, DataTable/I18nField/PriceField, ResourceConfig 엔진, 회원/파트너/상품/카테고리, L1~L3 테스트 계획, Session Guide | bandnara123 |
