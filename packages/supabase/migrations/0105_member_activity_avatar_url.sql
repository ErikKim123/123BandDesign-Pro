-- 0105: 어드민 '회원활동' 뷰에 회원 프로필 사진(avatar_url) 추가.
--
-- 0092 로 회원이 사진을 올릴 수 있게 됐는데 0066 뷰는 시드·특성만 내려 어드민이 늘 캐릭터만 봤다.
-- 두 뷰(피드 · 회원 요약)를 0066 정의 그대로 다시 만들고 avatar_url 한 컬럼씩만 더한다.
-- security_invoker 뷰는 create or replace 로 컬럼을 끼워 넣을 수 없어 drop 후 재생성한다(0066 과 같은 방식).
-- idempotent.

-- 1) 활동 통합 피드 -----------------------------------------------------------
drop view if exists band123.admin_activity_feed_v;
create view band123.admin_activity_feed_v
with (security_invoker = on) as
with raw as (
  -- 포인트 원장 ---------------------------------------------------------------
  select 'point:' || l.id::text as id,
         'point'::text          as kind,
         l.user_id              as user_id,
         l.created_at           as occurred_at,
         l.reason::text         as reason,
         null::text             as title,
         l.memo::text           as detail,
         l.delta::int           as delta,
         l.balance_after::int   as balance_after,
         null::numeric          as amount,
         null::text             as currency,
         null::int              as rating,
         null::uuid             as counterpart_id,
         l.id::text             as ref_id
  from band123.point_ledger l

  union all
  -- 스탬프 원장 ---------------------------------------------------------------
  select 'stamp:' || l.id::text, 'stamp', l.user_id, l.created_at,
         l.reason::text, null::text, l.memo::text,
         l.delta::int, l.balance_after::int,
         null::numeric, null::text, null::int, null::uuid, l.id::text
  from band123.stamp_ledger l

  union all
  -- 받은 하트 -----------------------------------------------------------------
  select 'heart_in:' || h.id::text, 'heart_in', h.to_user_id, h.created_at,
         coalesce(h.kind, 'heart')::text, null::text, h.message::text,
         null::int, null::int, null::numeric, null::text, null::int,
         h.from_user_id, h.id::text
  from band123.social_hearts h

  union all
  -- 보낸 하트 -----------------------------------------------------------------
  select 'heart_out:' || h.id::text, 'heart_out', h.from_user_id, h.created_at,
         coalesce(h.kind, 'heart')::text, null::text, h.message::text,
         null::int, null::int, null::numeric, null::text, null::int,
         h.to_user_id, h.id::text
  from band123.social_hearts h

  union all
  -- 주문 ---------------------------------------------------------------------
  select 'order:' || o.id::text, 'order', o.buyer_id, o.created_at,
         o.status::text, o.order_no::text, null::text,
         null::int, null::int, o.total_amount::numeric, o.currency::text, null::int,
         null::uuid, o.id::text
  from band123.orders o

  union all
  -- 상품 후기 (별점은 rating 으로) ----------------------------------------------
  select 'review:' || v.id::text, 'review', v.author_id, v.created_at,
         null::text,
         coalesce(pr.name_i18n->>'ko', pr.name_i18n->>'en', pr.code)::text,
         left(coalesce(v.content, ''), 200),
         null::int, null::int, null::numeric, null::text, v.rating::int,
         null::uuid, v.id::text
  from band123.product_reviews v
  left join band123.products pr on pr.id = v.product_id

  union all
  -- 상품 문의 -----------------------------------------------------------------
  select 'qna:' || q.id::text, 'qna', q.author_id, q.created_at,
         case when q.answered_at is null then 'pending' else 'answered' end,
         coalesce(pr.name_i18n->>'ko', pr.name_i18n->>'en', pr.code)::text,
         left(coalesce(q.question, ''), 200),
         null::int, null::int, null::numeric, null::text, null::int,
         null::uuid, q.id::text
  from band123.product_qna q
  left join band123.products pr on pr.id = q.product_id

  union all
  -- 게시글 (회원이 쓴 글만 — 어드민 공지는 바깥 role 조인에서 걸러진다) --------------
  select 'board:' || b.id::text, 'board', b.author_id, b.created_at,
         b.board_type::text,
         coalesce(b.title_i18n->>'ko', b.title_i18n->>'en', b.title)::text,
         null::text,
         null::int, null::int, null::numeric, null::text, null::int,
         null::uuid, b.id::text
  from band123.boards b

  union all
  -- 업적 달성 -----------------------------------------------------------------
  select 'achievement:' || a.id::text, 'achievement', a.user_id, a.earned_at,
         ac.code::text,
         coalesce(ac.name_i18n->>'ko', ac.name_i18n->>'en', ac.code)::text,
         null::text,
         null::int, null::int, null::numeric, null::text, null::int,
         null::uuid, a.id::text
  from band123.user_achievements a
  left join band123.achievements ac on ac.id = a.achievement_id

  union all
  -- 쿠폰 교환/발급 (교환이면 차감 포인트를 delta 로) -------------------------------
  select 'coupon:' || c.id::text, 'coupon', c.user_id, c.created_at,
         c.source::text, c.code::text, null::text,
         case when coalesce(c.point_cost, 0) > 0 then -c.point_cost::int else null::int end,
         null::int, null::numeric, null::text, null::int,
         null::uuid, c.id::text
  from band123.user_coupons c

  union all
  -- 친구 추천 성사 (추천인 타임라인에 남는다. 상대 = 추천으로 가입한 회원) ------------
  select 'referral:' || r.id::text, 'referral', r.referred_by, r.referred_at,
         null::text, null::text, null::text,
         null::int, null::int, null::numeric, null::text, null::int,
         r.id, r.id::text
  from band123.profiles r
  where r.referred_by is not null and r.referred_at is not null

  union all
  -- 가입 (타임라인의 출발점) -----------------------------------------------------
  select 'signup:' || p.id::text, 'signup', p.id, p.created_at,
         null::text, null::text, null::text,
         null::int, null::int, null::numeric, null::text, null::int,
         p.referred_by, p.id::text
  from band123.profiles p
)
select
  r.id,
  r.kind,
  r.user_id,
  r.occurred_at,
  r.reason,
  r.title,
  r.detail,
  r.delta,
  r.balance_after,
  r.amount,
  r.currency,
  r.rating,
  r.ref_id,
  -- 활동 주인 — 목록에서 아바타까지 그리므로 시드/특성을 같이 내린다.
  p.name         as member_name,
  p.email        as member_email,
  p.social_code  as member_code,
  p.avatar_seed  as member_avatar_seed,
  p.avatar_traits as member_avatar_traits,
  p.avatar_url    as member_avatar_url,
  -- 상대(하트를 주고받은 회원 / 추천으로 들어온 회원)
  r.counterpart_id,
  c.name         as counterpart_name,
  c.email        as counterpart_email,
  c.social_code  as counterpart_code
from raw r
join band123.profiles p on p.id = r.user_id and p.role = 'customer'
left join band123.profiles c on c.id = r.counterpart_id
where r.occurred_at is not null
  and band123.is_admin();

grant select on band123.admin_activity_feed_v to authenticated;

-- 2) 회원별 활동 요약 ---------------------------------------------------------
-- 화면 1번 탭(아바타 갤러리)이 카드 한 장에 필요한 값을 전부 담는다.
drop view if exists band123.admin_member_activity_v;
create view band123.admin_member_activity_v
with (security_invoker = on) as
select
  p.id,
  p.name,
  p.email,
  p.country,
  p.social_code,
  p.created_at,
  p.avatar_seed,
  p.avatar_traits,
  p.avatar_url,
  p.social_blocked_at,
  -- 회원이 편집기에서 직접 고른 항목이 하나라도 있으면 true (없으면 시드 기본값 그대로)
  (p.avatar_traits is not null and jsonb_typeof(p.avatar_traits) = 'object'
     and p.avatar_traits <> '{}'::jsonb)                                      as avatar_customized,
  coalesce(p.point_balance, 0)::int                                           as point_balance,
  coalesce(p.stamp_count, 0)::int                                             as stamp_count,
  (select count(*) from band123.social_hearts h where h.to_user_id = p.id)::int   as hearts_received,
  (select count(*) from band123.social_hearts h where h.from_user_id = p.id)::int as hearts_given,
  (select count(*) from band123.profiles r where r.referred_by = p.id)::int       as referral_count,
  (select count(*) from band123.orders o where o.buyer_id = p.id)::int            as order_count,
  (select count(*) from band123.product_reviews v where v.author_id = p.id)::int  as review_count,
  (select count(*) from band123.product_qna q where q.author_id = p.id)::int      as qna_count,
  (select count(*) from band123.boards b where b.author_id = p.id)::int           as board_count,
  (select count(*) from band123.user_achievements a where a.user_id = p.id)::int  as achievement_count,
  (select count(*) from band123.user_coupons c where c.user_id = p.id)::int       as coupon_count,
  (select count(*) from band123.point_ledger l where l.user_id = p.id)::int       as point_tx_count,
  (select count(*) from band123.stamp_ledger l where l.user_id = p.id)::int       as stamp_tx_count,
  -- 마지막 활동 시각 — greatest() 는 NULL 을 건너뛰므로 기록이 없는 항목은 그냥 빠진다.
  greatest(
    p.created_at,
    (select max(l.created_at) from band123.point_ledger l    where l.user_id = p.id),
    (select max(l.created_at) from band123.stamp_ledger l    where l.user_id = p.id),
    (select max(h.created_at) from band123.social_hearts h   where h.to_user_id = p.id),
    (select max(h.created_at) from band123.social_hearts h   where h.from_user_id = p.id),
    (select max(o.created_at) from band123.orders o          where o.buyer_id = p.id),
    (select max(v.created_at) from band123.product_reviews v where v.author_id = p.id),
    (select max(q.created_at) from band123.product_qna q     where q.author_id = p.id),
    (select max(b.created_at) from band123.boards b          where b.author_id = p.id),
    (select max(a.earned_at)  from band123.user_achievements a where a.user_id = p.id),
    (select max(c.created_at) from band123.user_coupons c    where c.user_id = p.id)
  )                                                                            as last_activity_at
from band123.profiles p
where p.role = 'customer'
  and band123.is_admin();

grant select on band123.admin_member_activity_v to authenticated;


notify pgrst, 'reload schema';
