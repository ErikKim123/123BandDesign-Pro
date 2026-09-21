// 고객(web) 앱 전용 인증 쿠키 이름.
// 주의: 쿠키는 포트를 구분하지 않으므로(localhost:3000/3001/3002 공유), 같은 Supabase
// 프로젝트를 쓰는 admin/partner 와 기본 쿠키명(sb-<ref>-auth-token)을 공유하면 서로의
// 세션을 덮어써 "어드민 계정이 web 에 로그인된" 것처럼 섞인다. 전용 이름으로 완전 분리.
export const WEB_AUTH_COOKIE = 'band-web-auth';

// 익명 방문자 식별 쿠키(로그인 여부 무관, 1년) — 어드민 방문자수/트래픽수 집계용.
export const VISITOR_ID_COOKIE = 'band_vid';
