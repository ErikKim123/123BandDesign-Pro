# wolf-admin Planning Document

> **Summary**: 운영자 백오피스(apps/admin) — Phase 0 스키마/RLS 위에 올리는 관리 화면. 공통 기반 + 회원/파트너/상품/카테고리 우선 구현
>
> **Project**: wolf-app (monorepo) / apps/admin
> **Version**: 0.1.0
> **Author**: bandnara123
> **Date**: 2026-06-04
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Phase 0에서 DB·RLS는 섰지만 데이터를 넣고 운영할 화면이 없다. 특히 파트너 입점 승인과 상품(자사/파트너) 관리가 막혀 메인·상품 페이지에 보여줄 데이터를 만들 수 없다. |
| **Solution** | apps/admin(Next.js App Router, role=admin)에 사이드바 레이아웃 + 인증 게이트 + 재사용 가능한 목록/상세/폼 패턴을 세우고, anon 클라이언트 + RLS `is_admin()`으로 데이터에 접근. 회원·파트너·상품·카테고리 CRUD를 먼저 구현. |
| **Function/UX Effect** | 운영자가 파트너 입점을 승인(pending→active)하고, 자사/파트너 상품을 다국어·다통화로 등록·승인하며, 카테고리 트리를 구성. 이후 화면(주문/배송/게시판/배너/메인)은 같은 패턴으로 확장. |
| **Core Value** | "한 번 만든 패턴으로 9개 화면을 찍어내는" 일관된 백오피스 기반 + 마켓플레이스 핵심 흐름(입점 승인·상품 등록)의 운영 가능화. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | DB만으로는 운영 불가 — 데이터를 넣고 파트너/상품을 관리할 백오피스가 있어야 Phase 2~4가 의미를 가진다. |
| **WHO** | 운영자(role=admin). 1차는 DB에서 수동 지정한 소수. |
| **RISK** | ① 권한 경계(비-admin 접근 차단) ② 다국어·다통화 입력 UX 복잡도 ③ 파트너 승인 상태 전이 오류 ④ 9개 화면 중복 구현으로 인한 불일치. |
| **SUCCESS** | admin 로그인 후 회원/파트너/상품/카테고리를 목록·검색·편집·저장 가능, 비-admin은 차단, 파트너 승인 흐름 동작. |
| **SCOPE** | 공통기반 + 회원/파트너/상품/카테고리(이번) → 주문/배송/게시판/배너/메인(후속 Plan). |

---

## 1. Overview

### 1.1 Purpose

Phase 0(스키마·RLS·모노레포) 위에 **운영자 관리 화면(apps/admin)**을 올린다. 가이드 §Phase 1 기준 9개 관리 화면 중, **데이터 입력의 핵심**(회원·파트너·상품·카테고리)을 먼저 구현하고 나머지는 동일 패턴으로 확장한다.

### 1.2 Background

- 데이터 구조(Phase 0)가 섰으니 이제 데이터를 넣을 화면이 필요. 관리 화면으로 데이터를 넣어야 메인(Phase 2)·상품(Phase 3)에 보여줄 게 생긴다.
- 마켓플레이스 특성상 **파트너 입점 승인**(pending→active→suspended)과 **상품 승인**(draft→pending→active) 흐름이 1급 요구.
- Phase 0에서 RLS `is_admin()` 정책이 모든 테이블에 적용됨 → admin은 anon 키로도 전체 접근 가능(추가 백엔드 불필요).

### 1.3 Related Documents

- 상위: [wolf-app.plan.md](wolf-app.plan.md) (전체 로드맵), [wolf-app.design.md](../../02-design/features/wolf-app.design.md) (스키마·RLS)
- 구축 가이드: [쇼핑몰_구축가이드_PDCA.md](../../../쇼핑몰_구축가이드_PDCA.md) §Phase 1
- 재사용 참조: 123pass-app apps/admin 패턴

---

## 2. Scope

### 2.1 In Scope

**공통 기반:**
- [ ] apps/admin Next.js(App Router) 초기화 + Tailwind + shadcn/ui + react-query 셋업
- [ ] 인증 게이트: Supabase Auth 로그인 + `role=admin` 확인 → 미인증/비-admin 차단(미들웨어 + 서버 가드)
- [ ] 사이드바 레이아웃 1개(9개 메뉴 네비) 재사용
- [ ] 공통 컴포넌트: DataTable(검색·필터·페이지네이션), FormFields(텍스트/셀렉트/토글), I18nField(en/ko), PriceField(USD/KRW), StatusBadge
- [ ] 공통 데이터 훅 패턴: react-query + Supabase anon 클라이언트(`@wolf/shared`)

**우선 화면 (4종):**
- [ ] 회원관리: profiles 목록(role/locale 필터·검색) → 상세/수정
- [ ] 파트너관리: partners 목록 → 입점 승인/반려(pending→active→suspended), commission_rate 편집
- [ ] 상품관리: products 목록(자사/파트너 구분, status 필터) → 등록/수정(name_i18n, prices USD/KRW, attributes, status 승인) — **수동 입력**(AI 생성은 Phase 3)
- [ ] 카테고리관리: categories 대/중 트리 + name_i18n + sort_order/is_visible

### 2.2 Out of Scope

- 주문/배송/게시판/배너/메인화면 관리 (후속 `/pdca plan wolf-admin-*` 또는 동일 패턴 확장)
- AI 상품페이지 생성 (Phase 3 — apps/api/NestJS)
- 어드민 초대/승격 흐름 (1차는 DB 수동 지정)
- 결제·정산 화면 (Phase 4)
- detail_html_i18n 리치 에디터 (1차는 textarea/기본 입력, sanitize는 Phase 3에서 렌더 시)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-00 | apps/admin 초기화(Next.js+Tailwind+shadcn/ui+react-query) + 모노레포 연동(@wolf/shared) | High | Pending |
| FR-01 | 인증: Supabase Auth 로그인 페이지 + 세션 | High | Pending |
| FR-02 | 인가 게이트: role=admin 아니면 /login 리다이렉트 (미들웨어 + 서버 컴포넌트 가드) | High | Pending |
| FR-03 | 사이드바 레이아웃(9개 메뉴) + 재사용 | High | Pending |
| FR-04 | 공통 DataTable(검색·필터·페이지네이션) | High | Pending |
| FR-05 | 공통 폼 컴포넌트(I18nField en/ko, PriceField USD/KRW, StatusBadge, Select/Toggle) | High | Pending |
| FR-06 | 회원관리: 목록(role/locale 필터, 이메일/이름 검색) + 상세/수정 | High | Pending |
| FR-07 | 파트너관리: 목록 + 승인/반려 상태전이(pending→active→suspended) + commission_rate/회사정보 편집 | High | Pending |
| FR-08 | 상품관리: 목록(자사·파트너·status 필터) + 생성/수정(name_i18n, prices, attributes, category, status 승인) | High | Pending |
| FR-09 | 카테고리관리: 대/중 트리 뷰 + 생성/수정(name_i18n, parent, sort_order, is_visible) | High | Pending |
| FR-10 | 목록 쿼리에서 products.detail_html_i18n 제외(성능) | Medium | Pending |
| FR-R1 | (로드맵) 주문관리 — orders 조회/상태 | Medium | Pending |
| FR-R2 | (로드맵) 배송관리 — shipments 국내/해외 | Medium | Pending |
| FR-R3 | (로드맵) 게시판/배너/메인화면 관리 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement |
|----------|----------|-------------|
| Security | 비-admin은 모든 /admin 경로·데이터 접근 차단 (미들웨어 + RLS 이중) | 비-admin 세션 접근 테스트 |
| Security | service_role 키 미사용(anon+RLS만) → 키 노출면 최소화 | 코드 grep |
| Performance | 목록 쿼리 페이지네이션 + detail_html 제외 | select 컬럼 검수 |
| i18n | en/ko 입력 폼, 누락 언어 en 폴백 표시 | pickI18n 적용 확인 |
| Consistency | 4개 화면이 동일 DataTable/Form 패턴 사용 | 컴포넌트 재사용률 |

---

## 4. Success Criteria

### 4.1 Definition of Done
- [ ] admin 계정으로 로그인 → 4개 화면 목록·검색·편집·저장 동작
- [ ] 비-admin/미인증 사용자가 /admin 접근 시 차단
- [ ] 파트너 승인 흐름(pending→active) 동작 + 상태 DB 반영
- [ ] 상품 등록 시 prices(USD/KRW)·name_i18n(en/ko) 저장, status 승인 전이
- [ ] 카테고리 대/중 트리 생성·노출순서 반영
- [ ] 공통 컴포넌트(DataTable/I18nField/PriceField) 4개 화면에서 재사용

### 4.2 Quality Criteria
- [ ] Lint/Build 통과, 타입 안전(@wolf/shared 타입 사용)
- [ ] 목록 쿼리에서 detail_html 제외 확인
- [ ] L1/L2 테스트(인증 가드, CRUD, 승인 전이) 작성

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 비-admin 접근 차단 누락 | High | Medium | 미들웨어 가드 + RLS 이중 방어, L1 인증 테스트 필수 |
| 다국어·다통화 입력 UX 복잡 | Medium | Medium | I18nField/PriceField 공통 컴포넌트로 캡슐화, en/ko만 1차 |
| 파트너/상품 상태 전이 오류 | Medium | Medium | 상태 머신을 명시(허용 전이만), StatusBadge+가드 |
| 9개 화면 중복 구현 불일치 | Medium | High | 공통기반(DataTable/Form/훅)을 먼저 확정 후 화면은 설정만 |
| anon 키로 admin 작업 시 RLS 정책 구멍 | High | Low | Phase 0 RLS 검증됨(13/13), 신규 정책 추가 시 재검증 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change |
|----------|------|--------|
| apps/admin | App | 신규 Next.js 앱 (현재 플레이스홀더 → 실제 구현) |
| profiles/partners/products/categories | DB (읽기/쓰기) | admin RLS 경유 CRUD — 기존 정책 사용(스키마 변경 없음) |
| @wolf/shared | Package | admin에서 타입·헬퍼·anon 클라이언트 소비 (변경 없음, 소비만) |

### 6.2 Current Consumers

| Resource | Operation | Code Path (예정) | Impact |
|----------|-----------|-----------|--------|
| products | CREATE/UPDATE | admin/상품관리 | 신규 (Phase 2/3 web이 읽기 소비) |
| partners | UPDATE(status) | admin/파트너관리 | 신규 — 정산(Phase 4)이 commission_rate 의존 |
| categories | CREATE/UPDATE | admin/카테고리관리 | 신규 (web 카테고리 띠가 소비) |

### 6.3 Verification
- [ ] 스키마 변경 없음 확인 (Phase 0 그대로 사용)
- [ ] 신규 RLS 정책 추가 시 wolf-app db:verify 재실행
- [ ] admin 쓰기가 RLS admin 정책으로 허용되는지 확인

---

## 7. Architecture Considerations

### 7.1 Project Level

Dynamic (모노레포 apps/admin). 백엔드 추가 없이 **anon 클라이언트 + RLS admin 정책**으로 데이터 접근 → Phase 1은 프런트 단독.

### 7.2 Key Architectural Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| App | apps/admin (Next.js App Router) | Phase 0 모노레포 구조, 고객/관리자 번들 분리 |
| 데이터 접근 | **anon 클라이언트 + RLS is_admin()** | 백엔드 불필요, service_role 노출 없음, Phase 0 RLS 검증 완료 |
| 인증 | Supabase Auth + role=admin 게이트 | 미들웨어(라우트 보호) + 서버 컴포넌트 가드 이중 |
| UI | **shadcn/ui + Tailwind** | 백오피스 CRUD 생산성, 123pass-app 정렬 |
| 서버상태 | react-query | 목록/뮤테이션 캐싱·무효화 |
| admin 지정 | **DB 수동(profiles.role='admin')** | 1차 단순, 초대/승격은 후속 |
| 폼 | react-hook-form (shadcn Form) | 검증·다국어 필드 관리 |

### 7.3 폴더 구조(예정)

```
apps/admin/
├── src/app/
│   ├── (auth)/login/          # 로그인
│   ├── (dashboard)/           # role=admin 게이트 그룹
│   │   ├── layout.tsx         # 사이드바 + 가드
│   │   ├── members/           # 회원관리
│   │   ├── partners/          # 파트너관리
│   │   ├── products/          # 상품관리
│   │   └── categories/        # 카테고리관리
│   └── middleware.ts          # 라우트 보호
├── src/components/
│   ├── data-table/            # DataTable(검색·필터·페이지네이션)
│   ├── form/                  # I18nField, PriceField, StatusBadge
│   └── ui/                    # shadcn 컴포넌트
└── src/lib/queries/           # react-query 훅 (members/partners/products/categories)
```

---

## 8. Convention Prerequisites

### 8.1 기존 컨벤션
- [x] @wolf/shared 타입·헬퍼(pickI18n/pickPrice) 재사용 (Phase 0)
- [ ] apps/admin tsconfig (tsconfig.base 확장) — 신규
- [ ] shadcn/ui 설정(components.json) — 신규

### 8.2 정의/확인할 것

| Category | To Define | Priority |
|----------|-----------|:--------:|
| 라우트 그룹 | (auth) / (dashboard) 분리, 가드 위치 | High |
| 데이터 훅 네이밍 | useMembers/useUpdatePartner 등 일관 패턴 | High |
| 상태 전이 규칙 | partner(pending→active→suspended), product(draft→pending→active→soldout) 허용 전이 | High |
| i18n 입력 | en/ko 탭형 입력, 빈 값 en 폴백 표시 | Medium |

### 8.3 환경변수 (apps/admin/.env)

| Variable | Scope |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client |

> service_role 키는 admin 앱에서 사용하지 않음(anon+RLS).

---

## 9. Next Steps

1. [ ] 이 Plan 검토·승인
2. [ ] `/pdca design wolf-admin` — 공통기반 + 4화면 아키텍처 3안
3. [ ] (전제) profiles에 admin 계정 1개 수동 지정 + anon/service_role 키를 .env에 채우기
4. [ ] Phase 1 우선화면 완료 후 → 나머지 5화면 동일 패턴 확장

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-06-04 | 초안 — Phase 1 운영자 관리(공통기반 + 회원/파트너/상품/카테고리), anon+RLS, shadcn/ui, admin DB 수동지정 | bandnara123 |
