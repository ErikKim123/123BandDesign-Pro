// 웹푸시(Web Push) 발송 — 서버 전용. 절대 클라이언트 컴포넌트에서 import 하지 말 것.
//
// web-push 패키지를 쓰지 않고 Node 내장 crypto 로 직접 구현한다. 이유 두 가지 —
//   1) 이 저장소는 외부 SDK 의존을 피하는 쪽이다(notify.ts 도 Brevo REST 를 fetch 로 직접 호출).
//   2) NAS(UNC) 환경에서 의존성 추가가 자주 실패한다.
//
// 표준: RFC 8291(메시지 암호화, aes128gcm) + RFC 8292(VAPID 서버 신원).
// 흐름: 브라우저가 준 공개키(p256dh)·인증시크릿(auth) 으로 페이로드를 암호화하고,
//       VAPID JWT 를 Authorization 에 실어 구독 endpoint 로 POST 한다.
//
// 필요 env:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY — VAPID 공개키(base64url, 65바이트 비압축 P-256). 클라이언트도 쓴다.
//   VAPID_PRIVATE_KEY            — VAPID 비밀키(base64url, 32바이트). 서버 전용.
//   VAPID_SUBJECT                — 연락처 mailto:/https: URL (푸시 서비스가 문제 시 연락할 곳)
import crypto from 'node:crypto';

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** 알림 클릭 시 열 경로 (절대 URL 또는 '/ko/account/social' 같은 경로) */
  url: string;
  /** 같은 tag 면 이전 알림을 덮어쓴다 */
  tag?: string;
  /** 홈 화면 아이콘에 얹을 안읽음 수. 없으면 서비스워커가 숫자 없이 점만 찍는다. */
  badge?: number;
  /** 알림 큰 아이콘(절대 URL). 없으면 서비스워커가 앱 아이콘을 쓴다. */
  icon?: string;
}

/** 발송 결과 — gone 이면 구독이 만료된 것이므로 호출부에서 행을 지운다. */
export type PushResult = 'ok' | 'gone' | 'error' | 'skipped';

const b64u = (buf: Buffer): string => buf.toString('base64url');
const fromB64u = (s: string): Buffer => Buffer.from(s, 'base64url');

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

// VAPID 비밀키(raw 32바이트)를 Node KeyObject 로. JWK 경로를 쓰면 PKCS8 DER 을 손으로 조립할 필요가 없다.
function vapidPrivateKey(publicKey: string, privateKey: string): crypto.KeyObject {
  const pub = fromB64u(publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID 공개키 형식 오류 — 65바이트 비압축(0x04) P-256 이어야 한다');
  }
  return crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64u(pub.subarray(1, 33)),
      y: b64u(pub.subarray(33, 65)),
      d: b64u(fromB64u(privateKey)),
    },
    format: 'jwk',
  });
}

// RFC 8292 — aud 는 푸시 서비스의 오리진, exp 는 24시간 이내여야 한다(12시간으로 둔다).
function vapidToken(audience: string): string {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:bandnara123@gmail.com';

  const header = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64u(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  // ECDSA 기본 출력은 DER 이지만 JWS 는 r||s 원시 64바이트를 요구한다 → ieee-p1363.
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: vapidPrivateKey(publicKey, privateKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${b64u(signature)}`;
}

// RFC 8291 §3.4 — 페이로드를 aes128gcm 단일 레코드로 암호화한다.
// 결과 = salt(16) | rs(4) | idlen(1) | 서버공개키(65) | 암호문+태그
// 반환 타입은 일부러 명시하지 않는다 — 최신 @types/node 의 Buffer/Uint8Array 는
// ArrayBufferLike 로 일반화돼 있어 DOM 의 BodyInit/BlobPart(ArrayBuffer 기반)와 맞지 않는다.
// 명시를 빼면 new Uint8Array(n) 의 구체 타입(Uint8Array<ArrayBuffer>)이 그대로 추론된다.
function encryptPayload(plaintext: Buffer, p256dh: string, authSecret: string) {
  const clientPublic = fromB64u(p256dh);
  const auth = fromB64u(authSecret);

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(clientPublic);

  // IKM 유도 — info 에 양쪽 공개키를 넣어 이 구독에만 쓰이는 키가 되게 한다.
  const ikmInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    clientPublic,
    serverPublic,
  ]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, auth, ikmInfo, 32));

  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16),
  );
  const nonce = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12),
  );

  // 마지막 레코드의 패딩 구분자는 0x02 (중간 레코드면 0x01). 우리는 항상 단일 레코드다.
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([0x02])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const header = Buffer.alloc(21 + serverPublic.length);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16); // record size — 페이로드가 짧아 4096 이면 충분
  header.writeUInt8(serverPublic.length, 20);
  serverPublic.copy(header, 21);

  const packet = Buffer.concat([header, ciphertext]);
  const out = new Uint8Array(packet.length);
  out.set(packet);
  return out;
}

/**
 * 구독 하나에 푸시를 보낸다. 예외를 던지지 않고 결과를 코드로 돌려준다 —
 * 하트 주기 같은 본 흐름이 알림 실패로 막히면 안 되기 때문이다.
 */
export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<PushResult> {
  if (!pushConfigured()) return 'skipped';
  try {
    const endpoint = new URL(sub.endpoint);
    const body = encryptPayload(Buffer.from(JSON.stringify(payload), 'utf8'), sub.p256dh, sub.auth);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: '86400', // 하루 안에 못 받으면 버린다 — 지난 하트 알림은 의미가 없다
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Urgency: 'normal',
        Authorization: `vapid t=${vapidToken(endpoint.origin)}, k=${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}`,
      },
      // fetch 의 BodyInit 타입은 Node/DOM 타입이 섞이면 Buffer·Uint8Array 를 거부한다.
      // Blob 은 양쪽 모두에서 유효한 BodyInit 이고 페이로드가 수백 바이트라 복사 비용도 무시할 만하다.
      body: new Blob([body]),
    });

    // 404/410 = 구독 만료(브라우저 재설치·권한 해제). 재시도해도 소용없으니 지워야 한다.
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}
