-- 0032: 인스타그램 일괄 업데이트(구글 시트 → 예약 게시) 지원.
-- ⚠️ SQL Editor 에서 0031 적용 후 실행.
-- 시트의 행마다 고유 키(external_ref, 예: 'sheet:P-001')를 달아, 같은 시트를 다시 불러와도
-- 중복 생성 대신 갱신되도록 한다(이미 게시된 행은 건드리지 않는다).

alter table instagram_posts
  add column if not exists external_ref text;

-- 같은 시트 행은 한 건만. external_ref 가 없는(수동 작성) 행은 제약에서 제외.
create unique index if not exists instagram_posts_external_ref_uidx
  on instagram_posts (external_ref)
  where external_ref is not null;
