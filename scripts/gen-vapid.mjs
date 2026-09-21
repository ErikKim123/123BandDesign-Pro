// VAPID 키쌍 생성 — 웹푸시(소셜 하트 알림)용. 한 번만 만들어 두고 env 에 넣는다.
//   node scripts/gen-vapid.mjs
// 출력값을 .env 와 Vercel 환경변수(123band-web)에 그대로 넣으면 된다.
//
// ⚠️ 키를 바꾸면 기존 구독이 전부 무효가 된다(브라우저가 applicationServerKey 로 구독을 묶는다).
//    한번 운영에 올린 뒤에는 재생성하지 말 것.
import crypto from 'node:crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// 공개키: 65바이트 비압축(0x04 | x | y) — JWK 의 x,y 를 이어 붙여 만든다.
const jwk = publicKey.export({ format: 'jwk' });
const b64u = (s) => Buffer.from(s, 'base64url');
const pub = Buffer.concat([Buffer.from([0x04]), b64u(jwk.x), b64u(jwk.y)]);

// 비밀키: raw 32바이트 (JWK 의 d)
const priv = b64u(privateKey.export({ format: 'jwk' }).d);

console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + pub.toString('base64url'));
console.log('VAPID_PRIVATE_KEY=' + priv.toString('base64url'));
