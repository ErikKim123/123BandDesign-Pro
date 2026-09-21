// 메일·QR 에 넣을 이 사이트의 절대 주소.
//
// 왜 따로 두나: 같은 뜻의 환경변수가 둘이라 한쪽이 조용히 썩었다.
//   NEXT_PUBLIC_SITE_URL — canonical·sitemap 이 쓴다. 검색결과에 그대로 나오므로 틀리면
//                          바로 티가 나고, 그래서 늘 맞는 값이 들어 있다.
//   NEXT_PUBLIC_WEB_URL  — 앱끼리 링크할 때만 쓴다. 아무도 눈으로 확인하지 않아서,
//                          배포 주소가 바뀐 뒤에도 옛 주소(123band-web.vercel.app)가
//                          그대로 남아 비밀번호 재설정 메일 링크가 404 로 죽어 있었다.
//
// 그래서 늘 맞는 쪽을 먼저 본다. 한쪽이 틀려도 메일은 살아 있어야 한다.
//
// 요청의 Host 는 마지막 수단이다. 메일에 들어가는 링크를 요청 헤더로 만들면, Host 를 바꿔
// 보낸 요청 하나로 '우리 메일에 담긴 남의 주소' 를 만들 수 있다(비밀번호 재설정에서는
// 계정을 통째로 내주는 길이 된다). 환경변수가 둘 다 없을 때만 쓴다.
const FALLBACK = 'https://123band-web.vercel.app';

/** 끝의 / 를 떼서 돌려준다 — 뒤에 경로를 붙일 때 // 가 생기지 않게. */
export function webBase(req?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_WEB_URL;
  const base = fromEnv || (req ? new URL(req.url).origin : FALLBACK);
  return base.replace(/\/+$/, '');
}
