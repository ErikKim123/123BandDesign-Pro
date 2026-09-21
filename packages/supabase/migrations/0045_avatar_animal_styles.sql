-- 0045: 캐릭터에 동물(강아지/고양이) 추가 — avatar_style 허용값 확장.
-- 0044 는 사람 2종(female/male)만 허용했다. 회원이 동물 캐릭터도 고를 수 있어야 하므로
-- 체크 제약을 4종으로 넓힌다. 기존 값은 모두 새 허용 집합에 포함되므로 데이터 변경은 없다.
-- idempotent.

alter table band123.profiles drop constraint if exists profiles_avatar_style_check;

alter table band123.profiles
  add constraint profiles_avatar_style_check
  check (avatar_style is null or avatar_style in ('female', 'male', 'dog', 'cat'));
