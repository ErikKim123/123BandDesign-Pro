-- 0039: 콘텐츠 작성 포인트 이벤트 — 후기(상품후기) / 댓글(상품문의) 작성 시 자동 지급.
-- 배경: "후기 쓰면 10P, 댓글 달면 10P" 이벤트. 지급액은 어드민 포인트관리 > 정책 설정에서 조절한다.
-- 훅 위치: API 라우트가 아니라 테이블 INSERT 트리거.
--   (1) 후기 라우트는 upsert 라 '수정'과 '신규'를 라우트에서 구분하기 어렵다.
--       ON CONFLICT DO UPDATE 는 INSERT 트리거를 발화시키지 않으므로 트리거가 정확히 신규만 잡는다.
--   (2) 나중에 다른 경로(어드민/배치)로 행이 생겨도 동일하게 적용된다.
-- 어뷰징 방지: 지급 단위를 '상품 1개당 1회'로 고정한다(point_ledger.ref_type/ref_id 로 멱등).
--   → 삭제 후 다시 써도 재지급되지 않고, 한 상품에 문의를 여러 번 달아도 1회만 지급된다.
-- idempotent.

-- 1) 원장 사유(reason) 확장 --------------------------------------------------
-- 0037 의 check 는 컬럼 인라인 제약이라 이름이 자동 생성된다(보통 point_ledger_reason_check).
-- 이름을 가정하고 drop 하면 실패해도 조용히 넘어가 옛 제약이 남고 새 사유가 거부되므로,
-- reason 컬럼을 참조하는 check 제약을 찾아서 전부 지운 뒤 새로 만든다.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'band123'
      and rel.relname = 'point_ledger'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%reason%'
  loop
    execute format('alter table band123.point_ledger drop constraint %I', r.conname);
  end loop;
end;
$$;
alter table point_ledger add constraint point_ledger_reason_check check (reason in (
  'signup',
  'admin_grant',
  'admin_deduct',
  'order_earn',
  'order_cancel',
  'coupon_exchange',
  'coupon_restore',
  'expire',
  'review_write',   -- 상품후기 작성 이벤트
  'qna_write'       -- 상품문의(댓글) 작성 이벤트
));

-- 2) 정책 기본값 추가 --------------------------------------------------------
-- '기본값 || 기존값' 순서라 관리자가 이미 바꾼 값은 보존되고, 없는 키만 채워진다.
insert into app_settings(key, value)
values ('points.policy', jsonb_build_object(
  'signup_bonus', 100, 'order_earn_percent', 0, 'coupon_valid_days', 30,
  'review_bonus', 10, 'qna_bonus', 10
))
on conflict (key) do update
  set value = jsonb_build_object('review_bonus', 10, 'qna_bonus', 10) || app_settings.value,
      updated_at = now();

-- 3) 지급 함수 ---------------------------------------------------------------
-- p_kind: 'review' | 'qna'. 반환값은 실제 지급한 포인트(0 = 미지급).
create or replace function band123.award_content_points(
  p_user_id uuid,
  p_kind text,
  p_product_id uuid
)
returns int
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_key text;
  v_reason text;
  v_memo text;
  v_amount int;
begin
  if p_user_id is null or p_product_id is null then return 0; end if;

  if p_kind = 'review' then
    v_key := 'review_bonus'; v_reason := 'review_write'; v_memo := '후기 작성 이벤트';
  elsif p_kind = 'qna' then
    v_key := 'qna_bonus';    v_reason := 'qna_write';    v_memo := '댓글(상품문의) 작성 이벤트';
  else
    return 0;
  end if;

  -- 상품당 1회 — 삭제 후 재작성/중복 작성 모두 재지급 없음
  if exists (
    select 1 from point_ledger
    where user_id = p_user_id and ref_type = p_kind and ref_id = p_product_id
  ) then
    return 0;
  end if;

  v_amount := coalesce((select (value->>v_key)::int from app_settings where key = 'points.policy'), 0);
  if v_amount <= 0 then return 0; end if;

  perform points_apply(p_user_id, v_amount, v_reason, v_memo, p_kind, p_product_id, null);
  return v_amount;
end;
$$;

revoke all on function band123.award_content_points(uuid, text, uuid) from public;
grant execute on function band123.award_content_points(uuid, text, uuid) to service_role;

-- 4) 후기 작성 트리거 --------------------------------------------------------
create or replace function band123.on_product_review_created()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  begin
    perform award_content_points(new.author_id, 'review', new.product_id);
  exception when others then
    null; -- 포인트 지급 실패가 후기 작성을 막지 않게 한다
  end;
  return new;
end;
$$;

drop trigger if exists product_reviews_award_points on band123.product_reviews;
create trigger product_reviews_award_points
  after insert on band123.product_reviews
  for each row execute function band123.on_product_review_created();

-- 5) 문의(댓글) 작성 트리거 ---------------------------------------------------
create or replace function band123.on_product_qna_created()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
begin
  begin
    perform award_content_points(new.author_id, 'qna', new.product_id);
  exception when others then
    null; -- 포인트 지급 실패가 문의 등록을 막지 않게 한다
  end;
  return new;
end;
$$;

drop trigger if exists product_qna_award_points on band123.product_qna;
create trigger product_qna_award_points
  after insert on band123.product_qna
  for each row execute function band123.on_product_qna_created();
