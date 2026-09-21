-- 0054: 배너 이미지 제공(크레딧) — 히어로 슬라이드 우측 하단에 작게 표시.
-- 사진 제공자/출처를 표기해야 하는 배너에만 채운다(비우면 미노출).
alter table banners add column if not exists image_credit text;
