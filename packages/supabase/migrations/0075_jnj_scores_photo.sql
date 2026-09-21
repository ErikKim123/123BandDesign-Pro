-- 0075: J&J 성적표 참가자 사진.
-- 전체 결과 표에서 번호·이름만으로는 누가 누군지 알기 어렵다. J&J Dash 참가신청 사진을
-- 그대로 가져와 이름 앞에 작은 썸네일로 붙인다(없으면 이니셜로 폴백).
-- idempotent.

alter table jnj_scores
  add column if not exists photo_url text;

comment on column jnj_scores.photo_url is
  'J&J Dash 참가자 사진 URL. 전체 결과 표의 썸네일. 비면 화면에서 이니셜로 대체된다.';
