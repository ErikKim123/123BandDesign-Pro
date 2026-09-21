-- 0021: 배너 부제/설명(다국어) — 히어로 슬라이드에서 제목 아래 표시.
-- 링크가 없어도 슬라이드에 안내 문구를 노출할 수 있게 한다.
alter table banners add column if not exists subtitle_i18n jsonb not null default '{}'::jsonb;
