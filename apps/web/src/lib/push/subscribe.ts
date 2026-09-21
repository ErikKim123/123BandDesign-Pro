// 브라우저 쪽 웹푸시 구독 헬퍼. 클라이언트 컴포넌트에서만 쓴다.
//
// iOS 주의: 사파리에서 그냥 접속한 상태에는 Notification/PushManager 가 아예 없다.
// 홈 화면에 추가해 PWA(standalone)로 실행해야 생긴다(iOS 16.4+). 그래서 '미지원'과
// '홈 화면 추가 필요'를 구분해서 돌려준다 — 안내 문구가 달라야 하기 때문이다.

export type PushSupport = 'ok' | 'unsupported' | 'ios-needs-install';

/** iOS(아이폰/아이패드) 여부 — iPadOS 는 UA 가 Mac 으로 나와서 터치 지원까지 본다. */
function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** 홈 화면에서 실행 중(standalone)인지 */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS 사파리 전용 비표준 플래그
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'ok';
  }
  // iOS 인데 API 가 없다 = 홈 화면 추가로 해결되는 경우
  if (isIos() && !isStandalone()) return 'ios-needs-install';
  return 'unsupported';
}

// 반환 타입을 명시하지 않는 이유: 명시하면 Uint8Array<ArrayBufferLike> 로 넓어져
// PushManager.subscribe 의 applicationServerKey(BufferSource, ArrayBuffer 기반)와 안 맞는다.
function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function toBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // AddToHomeScreen 이 이미 등록했겠지만, 소셜 탭에 먼저 들어온 경우를 위해 여기서도 보장한다.
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    /* 이미 등록돼 있으면 무시 */
  }
  return navigator.serviceWorker.ready;
}

/** 현재 이 기기가 구독 중인지 */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  const reg = await registration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export type SubscribeResult = 'ok' | 'denied' | 'unsupported' | 'error';

/** 권한 요청 → 구독 생성 → 서버 저장까지. */
export async function subscribePush(vapidPublicKey: string): Promise<SubscribeResult> {
  if (pushSupport() !== 'ok' || !vapidPublicKey) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const reg = await registration();
    if (!reg) return 'unsupported';

    // 이미 구독이 있으면 재사용 — 매번 새로 만들면 서버에 죽은 endpoint 가 쌓인다.
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true, // 표준상 필수. 조용한 푸시는 브라우저가 거부한다.
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: toBase64Url(sub.getKey('p256dh')),
        auth: toBase64Url(sub.getKey('auth')),
      }),
    });
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

/** 이 기기의 구독 해제(브라우저 + 서버 양쪽). */
export async function unsubscribePush(): Promise<boolean> {
  try {
    const sub = await currentSubscription();
    if (!sub) return true;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    return true;
  } catch {
    return false;
  }
}
