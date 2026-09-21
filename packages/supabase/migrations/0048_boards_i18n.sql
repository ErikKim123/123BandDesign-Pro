-- 0048_boards_i18n.sql
-- 게시판(공지/문의/후기/FAQ) 다국어 — title/content 평문 → title_i18n/content_i18n(jsonb).
--
-- 배경: 프로젝트의 고객 노출 텍스트는 전부 *_i18n jsonb({"ko":…,"en":…}) 규약인데(products.name_i18n,
--       banners.title_i18n, achievements.name_i18n …) boards 만 평문 컬럼이라 어드민에 한글 입력칸이
--       없었다. 그 결과 FAQ/공지가 영문으로만 들어가 /ko 에서도 영어가 보인다.
--
-- 호환: 레거시 title/content 는 지우지 않고 트리거로 계속 동기화한다(en 우선, 없으면 ko).
--       기존 조회/외부 쿼리가 깨지지 않게 두되, 쓰기의 진실은 *_i18n 이다.

-- 1) 다국어 컬럼 -------------------------------------------------------------
alter table band123.boards
  add column if not exists title_i18n   jsonb not null default '{}'::jsonb,
  add column if not exists content_i18n jsonb not null default '{}'::jsonb;

comment on column band123.boards.title_i18n   is '제목(다국어) {"ko":…,"en":…}. 표시의 기준.';
comment on column band123.boards.content_i18n is '본문(다국어) {"ko":…,"en":…}. 평문(줄바꿈 보존).';
comment on column band123.boards.title        is '[deprecated] title_i18n 에서 트리거로 동기화(en→ko 폴백). 직접 쓰지 말 것.';
comment on column band123.boards.content      is '[deprecated] content_i18n 에서 트리거로 동기화(en→ko 폴백). 직접 쓰지 말 것.';

-- 2) 기존 글 이관 ------------------------------------------------------------
-- 한글이 섞여 있으면 ko, 아니면 en 으로 넣는다. 반대 언어는 비워 둬서
-- 어드민 목록의 "번역 필요" 배지에 그대로 잡히게 한다(운영자가 채울 대상).
update band123.boards set
  title_i18n = case
    when title_i18n <> '{}'::jsonb              then title_i18n
    when coalesce(btrim(title), '') = ''        then title_i18n
    when title ~ '[가-힣ㄱ-ㅎㅏ-ㅣ]'             then jsonb_build_object('ko', title)
    else                                             jsonb_build_object('en', title)
  end,
  content_i18n = case
    when content_i18n <> '{}'::jsonb            then content_i18n
    when coalesce(btrim(content), '') = ''      then content_i18n
    when content ~ '[가-힣ㄱ-ㅎㅏ-ㅣ]'           then jsonb_build_object('ko', content)
    else                                             jsonb_build_object('en', content)
  end
where title_i18n = '{}'::jsonb or content_i18n = '{}'::jsonb;

-- 3) 레거시 컬럼 동기화 ------------------------------------------------------
-- 어드민은 *_i18n 만 보낸다. 레거시 컬럼이 낡은 값으로 남아 혼란을 주지 않도록 매 쓰기마다 다시 채운다.
create or replace function band123.boards_sync_legacy_text()
returns trigger
language plpgsql
set search_path = band123
as $$
begin
  new.title := nullif(
    coalesce(
      nullif(btrim(new.title_i18n->>'en'), ''),
      nullif(btrim(new.title_i18n->>'ko'), ''),
      new.title,
      ''
    ), '');
  new.content := nullif(
    coalesce(
      nullif(btrim(new.content_i18n->>'en'), ''),
      nullif(btrim(new.content_i18n->>'ko'), ''),
      new.content,
      ''
    ), '');
  return new;
end;
$$;

drop trigger if exists trg_boards_sync_legacy on band123.boards;
create trigger trg_boards_sync_legacy
  before insert or update on band123.boards
  for each row execute function band123.boards_sync_legacy_text();
