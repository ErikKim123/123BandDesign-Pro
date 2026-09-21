// 123Band PWA 최소 서비스워커.
// 오프라인 캐싱은 하지 않는다(스테일 캐시 리스크 회피). 목적은 두 가지 —
//   1) Chrome 계열의 설치 프롬프트(beforeinstallprompt) 발화 조건인 'fetch 핸들러 존재' 충족.
//      respondWith 를 호출하지 않으므로 모든 요청은 네트워크 기본 동작으로 통과(패스스루)한다.
//   2) 웹푸시 수신 — 소셜 하트를 받으면 앱이 닫혀 있어도 알림을 띄운다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* 패스스루 — 캐싱/가로채기 없음 */
});

// 서버(/lib/push/notify-user.ts)가 보내는 페이로드: { title, body, url, tag, icon, badge }
// badge 는 안읽음 수 — 홈 화면 아이콘에 얹을 숫자다.
// 페이로드 해석에 실패해도 알림 자체는 띄운다 — 조용히 삼키면 사용자는 알 방법이 없다.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || '123Band';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    // 상태바·알림 머리의 작은 아이콘. 안드로이드는 이 이미지의 '투명도'만 보고 흰색으로 칠한다 —
    // 컬러 로고(icon-192, 불투명한 원)를 주면 흰 동그라미만 보인다. 투명 배경 + 흰 실루엣 전용 파일.
    badge: '/badge-96.png',
    // 같은 tag 면 이전 알림을 덮어쓴다 — 하트가 연달아 와도 알림창이 쌓이지 않게.
    tag: data.tag || 'band-social',
    renotify: true,
    // 짧게 두 번. 안드로이드가 쓰고, 아이폰은 iOS 알림 설정이 정한다(이 값은 무시된다).
    vibrate: [12, 90, 12],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));

  // 홈 화면 아이콘 배지 — 앱을 닫아 둔 사이에 온 알림도 아이콘에 숫자로 남는다.
  // 숫자를 못 받았으면 점만 찍는다(인자 없는 setAppBadge). 지원 안 하면 조용히 넘어간다.
  if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
    const n = typeof data.badge === 'number' ? data.badge : null;
    event.waitUntil(
      (n === null ? self.navigator.setAppBadge() : self.navigator.setAppBadge(n)).catch(() => {}),
    );
  }
});

// 알림 클릭 — 이미 열려 있는 탭이 있으면 그 탭을 재사용해 이동, 없으면 새로 연다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // 같은 오리진의 탭이면 거기서 이동시킨다(중복 탭 방지).
        if ('focus' in client && 'navigate' in client) {
          return client.focus().then((c) => c.navigate(target));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
