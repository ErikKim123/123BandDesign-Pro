-- Design Ref: 티켓 = 이벤트 페이지 템플릿. 입력형 구조화 콘텐츠를 jsonb 로 저장.
-- ⚠️ SQL Editor 에서 0001~0005 적용 후 실행.
-- event_content 구조(EventContent): banner/badge/subtitle/location/priceText(i18n),
--   startAt/endAt/applyStart/applyEnd(text), sections{about,venue,notice,contact,channel,recommend,refund}(i18n HTML)
alter table products add column if not exists event_content jsonb;
