# URL 구조 (SEO URL Policy)

검색엔진이 읽는 주소 체계. 구현 단일 소스는 [`packages/shared/src/slug.ts`](../../../packages/shared/src/slug.ts) 의
`buildProductSlug()` · `productRelPath()` 이며, web(라우팅·canonical·sitemap)과 admin/partner(URL 미리보기)가 모두 이 함수를 쓴다.
**문서와 코드가 어긋나면 코드가 기준.**

## 1. 주소 지도

```
/{locale}/                      홈
/{locale}/events                행사 캘린더(목록)
/{locale}/events/{slug}         행사(티켓) 상세          ← 정식
/{locale}/shop                  상점(목록)
/{locale}/shop/{slug}           일반 상품 상세            ← 정식
/{locale}/categories/{id}       카테고리
/{locale}/boards …              고객지원 등 정적 경로
/{locale}/products/{uuid}       레거시 상세 → 정식 URL 로 301
```

| | |
|---|---|
| EN | `https://www.worldoflatinfestivals.com/en/events/mbf-melbourne-bachata-festival-2026-tickets` |
| KO | `https://www.worldoflatinfestivals.com/ko/events/mbf-melbourne-bachata-festival-2026-tickets` |

경로 세그먼트는 **브레드크럼과 같은 모양**이다 — `홈 > Events > MBF …`. 검색결과의 경로 표시(BreadcrumbList)와 URL 이 일치한다.

## 2. 원칙

1. **한 페이지 = 한 주소.** uuid·대문자·옛 슬러그·잘못된 섹션(`/shop/{티켓슬러그}`)으로 들어오면 전부 정식 주소로 **301**.
2. **주소에 검색어가 들어간다.** 행사명·도시·연도 + 의도어(`tickets`). `"melbourne bachata festival tickets"` 류 검색어와 URL 이 직접 매칭된다.
3. **소문자 ASCII + 하이픈만.** 밑줄·공백·대문자·퍼센트인코딩·쿼리스트링 없음.
   (`?preview=1` 은 예외 — 미승인 미리보기용이며 해당 페이지는 `noindex`.)
4. **얕게.** 로케일 포함 3단(`/en/events/{slug}`). 도시·국가는 슬러그 안에 넣고 경로를 깊게 만들지 않는다 —
   주소 변경 없이 오거나이저가 장소를 수정할 수 있다.
5. **슬러그는 로케일 공용(영문 1개).** `/en/…` 과 `/ko/…` 가 같은 슬러그를 쓰므로 hreflang 짝이 항상 성립하고,
   카톡·인스타 공유에서 URL 이 깨져(`%EB%A9%9C…`) 보이지 않는다.
6. **발행 후 고정.** 행사명을 고쳐도 URL 은 그대로 둔다. 사람이 직접 바꾼 경우에만 변경하고, 옛 주소는 `previous_slugs` 로 301 한다.
7. **sitemap 에는 정식 주소만.** 301 되는 주소를 실으면 색인이 지연된다.

## 3. 슬러그 생성 규칙

```
[행사명] [유형] [도시] [연도] [tickets]
```

| 슬롯 | 값 | 출처 |
|---|---|---|
| 행사명 | 영문명 우선(없으면 다른 로케일 → 로마자 변환) | `products.name_i18n` |
| 유형 | festival / congress / workshop / bootcamp / party / social / competition | `event_content.eventType` |
| 도시 | `address.city` → `address.province`. 숫자가 섞이면(주소 조각) 국가명으로 대체 | `event_content.address` |
| 연도 | 시작일의 연도 | `event_content.startAt` |
| 의도어 | `tickets` — 티켓 상품에만 | `products.product_type` |

* **중복 금지.** 이름에 이미 있는 토큰은 붙이지 않는다(하이픈 토큰 단위 비교).
  `MBF Melbourne Bachata Festival` + festival + Melbourne + 2026 → `mbf-melbourne-bachata-festival-2026-tickets`
* **변환.** 발음구별기호는 근사 치환(`Coruña → coruna`), 한글은 로마자(`서울 살사 → seoul-salsa`), `&` → `and`, 아포스트로피는 삭제(`Lucia's → lucias`).
* **길이 예산 `SLUG_MAX = 72`** (이름 부분은 56). 초과하면 **유형 → 도시 → 의도어 → 연도** 순으로 덜어낸다.
  연도를 마지막까지 남기는 이유: 연차 행사(2026/2027)가 같은 슬러그로 충돌해 `-2` 가 붙는 것을 막는다.
* **유일성.** 전역 유니크. 충돌하면 DB 트리거가 `-2`, `-3` … 을 붙인다.

## 4. 정규화 · 리다이렉트

| 들어온 주소 | 결과 |
|---|---|
| `/shop` (로케일 없음) | 308 → `/en/shop` (middleware) |
| `/en/events/MBF-…` (대문자) | 308 → `/en/events/mbf-…` (middleware, 로케일 세그먼트는 제외) |
| `/en/products/{uuid}` | 301 → `/en/events/{slug}` (슬러그 없으면 그대로 렌더) |
| `/en/events/{uuid}` | 301 → `/en/events/{slug}` |
| `/en/shop/{티켓 슬러그}` | 301 → `/en/events/{슬러그}` |
| `/en/events/{옛 슬러그}` | 301 → 현재 슬러그 (`previous_slugs` 역조회) |
| 없는 슬러그 | 404 |
| `?preview=1` | 렌더 + `noindex` (쿼리는 301 시에도 유지) |

로케일 리다이렉트는 308, 상세 라우트의 정식화는 `permanentRedirect()`(308). 구글은 301/308 을 동일하게 '영구'로 취급한다.

## 5. 데이터 (0035)

* `products.slug text` — 부분 유니크 인덱스(`slug is not null`).
* `products.previous_slugs text[]` — 옛 주소 목록. GIN 인덱스로 역조회.
* 트리거 `products_slug_guard` — ① 형식 강제 ② 비었으면 생성 ③ 유일성(`-2`, `-3`) ④ 변경 시 옛 슬러그 보존.
  앱(`buildProductSlug`)이 안 채우고 들어온 행(SQL 직접 입력·연동·백필)까지 형식을 보장하는 **안전망**이다.
* 백필: `update products set slug = null where slug is null;` 한 줄이면 트리거가 전부 채운다.

**미적용 상태에서도 사이트는 돈다.** web 은 `slug` 컬럼 존재 여부를 1회 탐지(`lib/queries/columns.ts`)해
없으면 레거시 `/products/{uuid}` 로 동작하고, 위저드는 저장 시 42703 이 나면 슬러그만 빼고 다시 저장한다.

## 6. 운영 (오거나이저/어드민)

* 위저드 **상세 콘텐츠 → SEO** 단계에 `검색 주소 (URL)` 필드가 있다. 비워두면 저장 시 자동 생성된다 — **대부분 비워두는 편이 낫다.**
* 이미 발행된 행사의 주소를 바꾸면 옛 주소는 301 로 이어지지만, **검색 순위가 새 주소로 옮겨가는 데 시간이 걸린다.**
  오탈자 등 분명한 이유가 없으면 바꾸지 않는다.

## 7. 하지 말 것

* 주소에 키워드 나열(`bachata-salsa-kizomba-festival-tickets-2026-best-cheap`) — 스팸으로 평가된다.
* 날짜·회차 같은 변동값을 경로 세그먼트로 만들기 — 매년 URL 이 바뀌어 순위가 초기화된다.
* 같은 상세를 여러 경로로 노출(`/products/{id}` 와 `/events/{slug}` 를 둘 다 색인) — canonical 과 301 로 반드시 하나로 모은다.
* 한글/공백/대문자 슬러그 — 공유 시 퍼센트인코딩으로 깨지고, 대소문자 차이로 중복 URL 이 생긴다.
