# wolf-admin Gap Analysis (Check Phase)

> **Target**: Phase 1 운영자 관리 — 공통기반 + 회원/파트너/상품/카테고리 (module 1~4)
> **Date**: 2026-06-04
> **Mode**: Static-only (dev 서버/Playwright 미기동)
> **Design**: [wolf-admin.design.md](../02-design/features/wolf-admin.design.md)
> **Plan**: [wolf-admin.plan.md](../01-plan/features/wolf-admin.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | DB만으론 운영 불가 — 데이터 입력·파트너/상품 관리 백오피스 |
| **WHO** | 운영자(role=admin, DB 수동 지정) |
| **RISK** | 권한 차단 / 다국어 입력 / 상태 전이 / 9화면 중복 |
| **SUCCESS** | 4화면 CRUD + 비-admin 차단 + 파트너 승인 |
| **SCOPE** | 공통기반+4화면(완료) → 5화면 후속 |

---

## 1. Match Rate

| 축 | 매치율(초기) | 매치율(수정후) | 가중치 |
|----|:-----:|:-----:|:-----:|
| Structural | 100% | 100% | 0.2 |
| Functional | 92% | 92% | 0.4 |
| Contract | 95% | **99%** | 0.4 |
| **Overall (정적)** | **94.8%** | **96.4%** | — |
| Runtime (L1) | 미실행 | **L1 6/6 PASS** | (데이터/RLS 계층 실측) |
| Runtime (L2/L3) | 미실행 | 차단 | (C: 디스크 풀 — dev 서버 미설치) |

> Important 2건(G1/G2) 수정으로 Contract 95→99%, Overall 94.8→**96.4%**.

### Runtime 결과 (2026-06-04, 실 Supabase)

**L1 — 데이터/RLS (`node apps/admin/tests/l1-admin-data.mjs`): 6/6 PASS**
| # | 검증 | 결과 |
|---|------|:----:|
| 1 | admin partners 전체 조회 | ✅ |
| 2 | 비-admin profiles 격리 | ✅ |
| 3 | partner 상태전이 pending→active | ✅ |
| 4 | product upsert prices jsonb | ✅ |
| 5 | 목록 select detail_html 제외 | ✅ |
| 6 | 파트너 타 판매자 비공개 상품 미노출 | ✅ |

**빌드 검증 — `next build`: ✓ 성공** (npm 캐시/임시를 z:로 우회해 의존성 설치 후)
- 타입체크 통과(0 에러), 9개 라우트 전부 컴파일, 프로덕션 빌드 완료
- 빌드 중 발견·수정한 실제 버그: ① @wolf/shared `.js` import → webpack 해석 실패(확장자 제거) ② 로그인 useSearchParams Suspense 경계 누락(래핑) ③ 쿠키 콜백 타입/zod 인덱스/upsert 타입 등 6건

**L2/L3 — UI/E2E (Playwright): 미실행** — dev 서버 기동 + 실제 anon 키(.env.local) + admin Auth 비밀번호 + Playwright/chromium 설치 필요. 테스트 파일(`tests/e2e/wolf-admin.spec.ts`)은 작성 완료(L2 5건/L3 1건). C: 디스크 풀로 chromium 다운로드 보류.

> **검증 수준**: 데이터 계층(L1) 실측 PASS + 전체 코드 컴파일·타입·프로덕션 빌드 검증 완료. 남은 것은 라이브 UI 상호작용(L2/L3)뿐 — 정적 96.4% 대비 실측 신뢰도 대폭 상승.

## 2. Strategic Alignment (Plan SC §4)

| 기준 | 상태 | 근거 |
|------|:----:|------|
| 4화면 목록·검색·편집·저장 | ✅ Met | members/partners/products/categories page.tsx |
| 비-admin/미인증 차단 | ✅ Met | middleware + (dashboard)/layout role 가드 + RLS |
| 파트너 승인 흐름 | ✅ Met | PARTNER_TRANSITIONS 허용전이만 |
| 상품 prices(USD/KRW)·name_i18n 저장 + status 전이 | ✅ Met | products config + PriceField/I18nField |
| 카테고리 대/중 트리 | ✅ Met | categories/page.tsx 트리 |
| 공통 컴포넌트 재사용 | ✅ Met | DataTable/I18nField/PriceField 4화면 공유 |
| 전역: 반응형 + Design_System | ✅ Met | AdminSidebar 드로어, tailwind JNJ 토큰 |

## 3. Gap List

### 🔴 Missing — 없음 (4화면 범위)

### 🟡 Important — ✅ 해결 완료
| # | 항목 | 조치 |
|---|------|------|
| G1 | attributes JSON 검증 | ✅ JsonField 컴포넌트 — 파싱 실패 시 인라인 에러("JSON 형식이 올바르지 않습니다.") + input-error 스타일 + 제출 차단(jsonErrors→onSubmit 가드). L2 #4 단언 강화 |
| G2 | zod 폼 검증 | ✅ ResourceConfig.schema 추가 — partners(commission_rate 0~1, status enum), products(prices 정수≥0, type/status enum). ResourceFormPage onSubmit에서 safeParse → 첫 에러 표시 |

### 🔵 Minor (문서 동기화 또는 선택)
| # | 항목 | 조치 |
|---|------|------|
| G3 | 상품 name_i18n 검색 누락(code만) | 추가 또는 Design 제외 표기 |
| G4 | 상품 is_partner_product 필터 미노출(컬럼은 표시) | 추가 또는 제외 표기 |
| G5 | 회원 role 컬럼 텍스트(badge 아님) | StatusBadge 적용 or 표현 완화 |
| G6 | useCategories가 page.tsx 내부 정의(react-query 캡슐화는 유지) | lib/queries로 이동(선택) |
| G7 | shadcn/ui 대신 직접 작성 컴포넌트 | Design에 반영(코드가 truth) |
| G8 | lib/supabase/client가 @supabase/ssr 직접(@wolf/shared 미경유) | Design 반영 |
| G9 | CategoryTree 인라인(별도 컴포넌트 아님) | Design 반영 |

### 🟢 Added (긍정)
- `useStatusTransition` 범용 전이 훅(분리 대신 통합, DRY)

## 4. Test Plan 반영 (§8)
| Level | 반영 | 비고 |
|-------|:----:|------|
| L1 (데이터/RLS) | ✅ 5+1건 | l1-admin-data.mjs (실행은 DATABASE_URL 필요) |
| L2 (UI Action) | ⚠️ 4/5 | #4 JSON 검증 단언 부족, #5 중분류 추가 미작성 |
| L3 (E2E) | ⚠️ 1/2 | 입점→판매 풀플로우·권한차단 보강 필요 |

## 5. 권장 조치
1. (Important) G1 — json 필드 파싱 실패 시 에러 state + 제출 차단
2. (Important) G2 — zod 스키마 검증 적용(commission_rate/prices/status)
3. (선택) G3~G9 문서/코드 동기화, L2#5·L3#1 테스트 보강
4. (Runtime) dev 서버 기동 + Playwright 설치 후 L1/L2/L3 실행 → 매치율 재산정
