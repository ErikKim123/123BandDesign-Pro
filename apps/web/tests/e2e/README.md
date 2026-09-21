# web E2E (Playwright, 헤드리스 chromium)

라이브 DB·라이브 PG 샌드박스를 그대로 쓰는 클릭 테스트다. 목업이 아니다.

## 실행

```bash
# 루트에서. node_modules/.bin/playwright 가 없어 cli.js 를 직접 부른다(NAS 환경).
node node_modules/@playwright/test/cli.js test --config apps/web/playwright.config.ts
```

전제: `apps/web` dev 서버(:3000) 기동. dev 는 라우트 첫 접근 시 컴파일이 느려 timeout 을 150s 로 잡아 뒀다.

| 스펙 | 확인 범위 |
| --- | --- |
| `web-shop.spec.ts` · `shop-types.spec.ts` | 고객 탐색/장바구니/주문 플로우 |
| `payverse-checkout.spec.ts` | KRW 결제창이 열리는지(서명·가맹점 파라미터 검증) |
| `payverse-checkout-usd.spec.ts` | USD(해외) 결제창 + 카드 입력폼 렌더 |
| `payverse-refund.spec.ts` | **실결제 승인 → 어드민 환불(PG 취소)** — 아래 참고 |
| `jnj-section-nav.spec.ts` | J&J 섹션 칩 — 스크롤한 섹션 · 누른 섹션의 칩이 오렌지로 켜짐 |
| `live-jnj-division.spec.ts` | 라이브 ↔ J&J 부문 — 섬네일·타이틀 하단·섹션 표시 + 다른 부문 제외. **기본 skip** (`E2E_LIVE=1` 로 실행, 도는 동안 실사이트에 LIVE 배너가 잠깐 뜬다) |
| `notice-card.spec.ts` | 운영자 알림 배너 — 상단 표시(제목만) · 8초 자동 사라짐 · hover 정지 · 읽으면 배지 0 · 한 건/모두 삭제 |

## payverse-refund: 승인만 사람 손이 필요하다

샌드박스는 카드 정보를 다 넣어도 마지막에 **PayVerse Echo 앱 QR 인증**(글로벌카드) 또는
카드사 앱 인증(국내카드)을 거쳐야 승인이 난다. 헤드리스로 대신할 방법이 없다.
그래서 이 스펙은 카드 입력까지 자동으로 간 뒤 QR 을 띄워 두고 주문이 `paid` 가 될 때까지 기다린다.
스캔이 없으면 대기 시간(`E2E_APPROVE_WAIT`, 기본 240초) 후 skip 된다.

```bash
# 1) web dev(:3000) 과 admin dev(:3001) 을 모두 띄운다
# 2) 어드민 세션 쿠키를 만든다 (apps/admin 에서)
node -e "
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const get=k=>env.match(new RegExp('^'+k+'\\\\s*=\\\\s*\"?([^\"\\n\\r]+)\"?','m'))[1];
(async()=>{
  const r=await fetch(get('NEXT_PUBLIC_SUPABASE_URL')+'/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{apikey:get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),'Content-Type':'application/json'},
    body:JSON.stringify({email:'admin@123band.test',password:'Band!2026'})});
  const s=await r.json();
  console.log('band-admin-auth=base64-'+Buffer.from(JSON.stringify(s)).toString('base64'));
})();"

# 3) 위 출력을 넣고 headed 로 실행 → 뜨는 QR 을 Echo 앱으로 스캔
E2E_ADMIN_COOKIE='band-admin-auth=base64-...' \
node node_modules/@playwright/test/cli.js test --config apps/web/playwright.config.ts \
  payverse-refund.spec.ts --headed
```

승인이 확인되면 그 뒤(어드민 환불 호출 → `pgCancelled` 확인 → 주문 `refunded` 확인)는 전부 자동이다.

## 결제창 자동화 주의점 (실측)

- 카드번호는 **앞 8자리 일반 input + 4 + 4 는 Stealien 보안키패드** 세 칸으로 쪼개져 있다.
- 키패드는 누를 때마다 키 배치를 섞는다 → Playwright 의 stable 판정이 끝나지 않으므로 **force 클릭** 필수.
- 키패드 인스턴스가 칸마다 따로 있고 **닫힌 것도 DOM 에 남는다** → `._stealien_keybutton:visible` 로 골라야 한다.
  (`.first()` 만 쓰면 닫힌 키패드를 집어 "not visible" 로 멈춘다.)
- 한 칸이 다 차면 다음 칸으로 포커스가 자동 이동하고, 키패드가 열려 있는 동안 아래쪽 폼은 숨겨진다.
- 글로벌카드 폼은 이름/성 칸이 숨겨져 있고 이메일만 받는다. 동의 체크박스는 화면 밖이라 라벨을 클릭한다.
