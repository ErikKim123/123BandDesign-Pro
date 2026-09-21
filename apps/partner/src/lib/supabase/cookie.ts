// 오거나이저 앱 전용 인증 쿠키 이름.
// 주의: 쿠키는 포트를 구분하지 않으므로(localhost:3001/3002 공유), admin 과 같은
// Supabase 프로젝트를 쓰면 기본 쿠키명(sb-<ref>-auth-token)이 충돌해 서로의 세션을
// 덮어쓴다. 전용 이름을 줘서 admin/web 과 독립된 세션을 유지한다.
export const PARTNER_AUTH_COOKIE = 'band-partner-auth';
