-- 0035: 상품 URL 슬러그(검색엔진이 읽는 사람 친화 주소) + 옛 슬러그 301 이관 기록.
-- ⚠️ SQL Editor 에서 0034 적용 후 실행. web 배포 前에 먼저 적용하는 것을 권장한다.
--    (미적용이어도 사이트는 레거시 /{locale}/products/{uuid} 로 정상 동작한다 — web 이 컬럼 유무를 1회 탐지해 폴백)
--
-- 배경: 상세 URL 이 /en/products/9f3c…-uuid 라 검색엔진 관점에서 키워드가 0 이었다.
--       /en/events/mbf-melbourne-bachata-festival-2026-tickets 로 바꿔 URL 자체가 검색어와 매칭되게 한다.
--
-- 원칙:
--  1) 슬러그 생성 규칙의 단일 소스는 앱(@123band/shared/slug · buildProductSlug). 위저드가 저장할 때 그 값을 쓴다.
--  2) 이 트리거는 '안전망' — 슬러그 없이 들어온 행(레거시 백필·SQL 직접 입력·연동)에도 형식을 보장하고,
--     유일성 충돌(-2, -3 …)은 여기서 원자적으로 해결한다. 앱과 형식은 같고, 로마자 변환만 약하다.
--  3) 한 번 발행된 슬러그는 바꾸지 않는다. 사람이 바꾸면 옛 슬러그를 previous_slugs 에 남겨 301 로 잇는다.

alter table products add column if not exists slug text;
alter table products add column if not exists previous_slugs text[] not null default '{}';

comment on column products.slug is 'URL 슬러그(소문자 ASCII+하이픈). 정식 주소 /{locale}/events|shop/{slug}. 생성규칙 단일소스=@123band/shared buildProductSlug.';
comment on column products.previous_slugs is '과거에 쓰던 슬러그들. 상세 라우트가 여기 걸리면 현재 slug 로 301. 검색 순위 신호를 잃지 않기 위함.';

-- 슬러그는 페이지 신원이다 → 전역 유일. (null 은 다수 허용 = 아직 미발행)
create unique index if not exists products_slug_key on products (slug) where slug is not null;
-- 옛 슬러그 역조회(301) 용
create index if not exists products_previous_slugs_idx on products using gin (previous_slugs);

-- 임의 문자열 → 소문자 ASCII 슬러그 조각.
-- 발음구별기호는 translate 로 근사 치환(Coruña → coruna). 확장(unaccent) 의존을 피해 어떤 환경에서도 돈다.
create or replace function band123.slugify_ascii(src text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(
      translate(
        replace(replace(replace(replace(coalesce(src, ''), '&', ' and '), 'æ', 'ae'), 'Æ', 'ae'), 'ß', 'ss'),
        'àáâãäåèéêëìíîïòóôõöùúûüñçýÿšžðøłÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇÝŠŽÐØŁ',
        'aaaaaaeeeeiiiiooooouuuuncyyszdolAAAAAAEEEEIIIIOOOOOUUUUNCYSZDOL'
      )
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

comment on function band123.slugify_ascii(text) is '문자열 → URL 슬러그 조각. 앱(@123band/shared slugify)의 SQL 판(한글 로마자 변환은 미지원).';

-- 슬러그 정규화 · 자동생성 · 유일성 · 이력 보존을 한 곳에서 보장.
create or replace function band123.products_slug_guard()
returns trigger
language plpgsql
as $$
declare
  base   text;
  piece  text;
  cand   text;
  n      int := 1;
begin
  -- 1) 사람이 손으로 넣은 값도 형식을 강제한다(대문자·공백·특수문자·한글 유입 차단).
  if new.slug is not null then
    new.slug := nullif(band123.slugify_ascii(new.slug), '');
  end if;

  -- 2) 비어 있으면 생성: [이름] [유형] [도시] [연도] [tickets] — 이름에 이미 있는 토큰은 붙이지 않는다.
  if new.slug is null then
    base := band123.slugify_ascii(
      coalesce(nullif(new.name_i18n->>'en', ''), nullif(new.name_i18n->>'ko', ''), new.code, 'item')
    );
    base := left(base, 56);

    piece := band123.slugify_ascii(new.event_content->>'eventType');
    if piece <> '' and piece <> 'other' and position(piece in base) = 0 then
      base := base || '-' || piece;
    end if;

    piece := band123.slugify_ascii(new.event_content->'address'->>'city');
    if piece <> '' and piece !~ '[0-9]' and position(piece in base) = 0 then
      base := base || '-' || piece;
    end if;

    piece := substring(coalesce(new.event_content->>'startAt', '') from '^[0-9]{4}');
    if piece is not null and position(piece in base) = 0 then
      base := base || '-' || piece;
    end if;

    if new.product_type = 'ticket' and position('tickets' in base) = 0 then
      base := base || '-tickets';
    end if;

    -- 이름 자체가 비면(로마자 변환 불가) id 앞자리로 최소한의 고유 주소를 만든다.
    new.slug := nullif(trim(both '-' from left(base, 72)), '');
    if new.slug is null then
      new.slug := 'event-' || left(new.id::text, 8);
    end if;
  end if;

  -- 3) 유일성 — 충돌하면 -2, -3 … (동시 삽입은 부분 유니크 인덱스가 최종 방어)
  cand := new.slug;
  while exists (select 1 from products p where p.slug = cand and p.id <> new.id) loop
    n := n + 1;
    cand := left(new.slug, 68) || '-' || n::text;
  end loop;
  new.slug := cand;

  -- 4) 슬러그를 바꿨으면 옛 주소를 남긴다 → 상세 라우트가 301 로 이어준다.
  if tg_op = 'UPDATE' and old.slug is not null and old.slug is distinct from new.slug then
    new.previous_slugs := (
      select array(
        select distinct e
        from unnest(coalesce(new.previous_slugs, '{}'::text[]) || old.slug) as e
        where e <> new.slug
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists products_slug_guard_trg on products;
-- 모든 INSERT/UPDATE 에서 동작 → `update products set slug = null` 한 줄로 재생성이 가능하다.
create trigger products_slug_guard_trg
  before insert or update on products
  for each row execute function band123.products_slug_guard();

-- 기존 상품 백필: 트리거가 규칙대로 채운다. (이미 슬러그가 있는 행은 건드리지 않는다)
update products set slug = null where slug is null;
