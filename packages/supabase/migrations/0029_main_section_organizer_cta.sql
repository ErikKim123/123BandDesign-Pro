-- 0029: 메인화면관리 — 홈 하단 "오거나이저로 시작하세요" CTA를 main_sections로 편입.
-- 어드민 메인화면관리에서 노출(활성)/숨김(비활성) 토글로 제어. 웹 홈은 활성 organizer_cta 행이 있을 때만 렌더.

-- section_type CHECK 제약에 'organizer_cta' 추가 (기존 인라인 제약 교체)
alter table main_sections drop constraint if exists main_sections_section_type_check;
alter table main_sections add constraint main_sections_section_type_check
  check (section_type in ('hero','slider','featured','category_strip','organizer_cta'));

-- 시드: organizer_cta 행 1개(비활성=지금 숨김). 이미 있으면 건너뜀.
insert into main_sections (section_type, config, sort_order, is_active)
select 'organizer_cta', '{}'::jsonb, 50, false
where not exists (
  select 1 from main_sections where section_type = 'organizer_cta'
);
