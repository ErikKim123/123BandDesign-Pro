-- 0064: 쿠폰이 회원에게 발급되면 운영자에게 알리기 위한 DB → 앱 웹훅.
--
-- 왜 DB 트리거인가:
--   쿠폰 발급은 앱이 아니라 DB 안에서 일어난다.
--     · 스탬프 카드 완성 → redeem_stamp_card. 이건 결제확정/체크인/후기/문의 트리거와
--       관리자 수동지급, 고객화면의 claim_stamp_card 까지 여섯 갈래에서 불린다.
--     · 포인트 교환 → exchange_points_for_coupon (고객이 브라우저에서 직접 RPC 호출).
--   앱 코드에서 알리려면 web·admin·partner 세 앱의 여섯 지점에 같은 코드를 심어야 하고,
--   나중에 경로가 하나 늘면 조용히 누락된다. 발급 지점인 user_coupons INSERT 한 곳에
--   트리거를 걸면 어느 경로로 발급되든 빠짐없이 잡힌다.
--
-- 전송은 pg_net(비동기 HTTP)로 한다 — 트랜잭션을 막지 않고, 실패해도 발급은 유지된다.
-- 설정값(app_settings 'notify.webhook')이 없으면 아무것도 하지 않는다(로컬/개발 환경).
-- idempotent.

-- pg_net 은 Supabase 기본 제공 확장이다. extensions 스키마에 설치된다.
create extension if not exists pg_net with schema extensions;

-- 수신 URL 과 공유 시크릿. app_settings 는 어드민 전용 RLS 라 시크릿이 공개되지 않는다.
-- url 이 비어 있으면 트리거는 조용히 지나간다 → 운영에서만 켜고 로컬은 그대로 둔다.
insert into app_settings(key, value)
values ('notify.webhook', jsonb_build_object('url', '', 'secret', ''))
on conflict (key) do nothing;

create or replace function band123.notify_coupon_issued()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_cfg jsonb;
  v_url text;
  v_secret text;
begin
  -- 운영자가 알아야 하는 건 "고객 활동으로 나간 쿠폰"이다.
  -- 관리자가 직접 발급한 건(admin_grant 등)은 본인이 한 일이라 알리지 않는다.
  if new.source is null or new.source not in ('stamp_reward', 'point_exchange') then
    return new;
  end if;

  select value into v_cfg from app_settings where key = 'notify.webhook';
  v_url := nullif(btrim(coalesce(v_cfg->>'url', '')), '');
  v_secret := coalesce(v_cfg->>'secret', '');
  if v_url is null then return new; end if;

  -- 비동기 전송 — 응답을 기다리지 않는다. 본문에는 식별자만 담고,
  -- 상세(쿠폰명/회원)는 수신 측이 service role 로 조회한다(민감정보를 URL 밖으로 흘리지 않게).
  -- ⚠️ 확장은 extensions 스키마에 설치되지만 pg_net 은 함수를 자기 소유의 net 스키마에 만든다.
  --    extensions.net.http_post 로 부르면 없는 함수라 아래 exception 에 걸려 조용히 지나간다.
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('userCouponId', new.id, 'source', new.source),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  -- 알림 실패가 쿠폰 발급을 되돌리면 안 된다. 다만 조용히 삼키면 설정 오류를 못 찾으므로
  -- (함수 경로를 잘못 적어 전송이 통째로 빠졌던 적이 있다) 경고는 로그에 남긴다.
  raise warning '[notify_coupon_issued] 전송 실패: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists user_coupons_notify_admin on band123.user_coupons;
create trigger user_coupons_notify_admin
  after insert on band123.user_coupons
  for each row execute function band123.notify_coupon_issued();
