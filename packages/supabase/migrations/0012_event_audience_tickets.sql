-- Design Ref: goandance "Create Event" 레퍼런스 — 행사패스(ticket) 확장 필드.
-- event_content(jsonb)는 0006 에서 추가됨. 본 마이그레이션은 스키마 변경 없이
-- 확장된 구조를 문서화한다(애플리케이션 레벨 jsonb, 컬럼 추가 불필요).
--
-- EventContent 확장(EventContent in @123band/shared):
--   eventType : 'festival'|'congress'|'workshop'|'bootcamp'|'party'|'social'|'competition'|'other'
--   address   : { line1, city, postalCode, country, province }            -- 구조화 장소(Step3)
--   organizer : { name(i18n), logo(url), description(i18n), contact }      -- 주최자(Step2, 인라인)
--   tickets[] : { key, name(i18n), type, units, price(prices), feeMode }  -- 티켓 티어(Step5)
--               type    : 'full_pass'|'day_pass'|'party_pass'|'hotel'|'shuttle'|'other'
--               feeMode : 'client'|'absorb'
--   audience  : { estimatedAttendees, attendeesLocation, levels[], danceStyles[] }  -- 대상(Step6)
--               attendeesLocation : 'local'|'national'|'international'
--               levels            : ('beginner'|'intermediate'|'advanced')[]
--
-- 기존 RLS(0003: seller_id = auth.uid() with check)·인덱스를 그대로 사용한다.
-- no-op (문서용). event_content 가 없으면 0006 을 먼저 적용할 것.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'event_content'
  ) then
    raise exception 'products.event_content 컬럼이 없습니다. 0006_event_content.sql 을 먼저 적용하세요.';
  end if;
end $$;
