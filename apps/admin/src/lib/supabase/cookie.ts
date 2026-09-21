// 관리자(admin) 앱 전용 인증 쿠키 이름.
// 주의: 쿠키는 포트를 구분하지 않으므로(localhost:3000/3001/3002 공유), 같은 Supabase
// 프로젝트를 쓰는 web/partner 와 기본 쿠키명(sb-<ref>-auth-token)을 공유하면 서로의
// 세션을 덮어써 섞인다(어드민 세션이 web 으로 새는 등). 전용 이름으로 완전 분리.
export const ADMIN_AUTH_COOKIE = 'band-admin-auth';
