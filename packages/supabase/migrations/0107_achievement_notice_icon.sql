-- 0107: 업적 알림에 뱃지 아이콘 · 업적명
--
-- 0106 의 업적 알림은 제목이 '🏅 새 뱃지 · New badge' 하나로 고정이고 사이트 배너는 123Band 로고를 그렸다.
-- 어떤 뱃지인지가 배너 한 줄에 보이도록 (1) 제목에 업적명을 넣고 (2) 알림 행에 아이콘 URL 을 둔다.
-- 아이콘은 알림함 전체의 공통 컬럼(icon_url) — 운영자 공지는 null 로 두면 기존처럼 로고가 나온다.
-- (3) 자동 지급은 어드민이 푸시 웹훅을 불러 주지 않으므로 트리거가 직접 pg_net 으로 부른다(0064 와 같은 방식).
-- idempotent.

alter table band123.member_notices add column if not exists icon_url text;
comment on column band123.member_notices.icon_url is
  '배너·알림함 왼쪽 아이콘(뱃지 이미지 등). null 이면 123Band 로고.';

create or replace function band123.notify_achievement_earned()
returns trigger
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_a achievements;
  v_ko text;
  v_en text;
  v_points text := '';
  v_batch uuid;
  v_cfg jsonb;
  v_url text;
  v_secret text;
begin
  select * into v_a from achievements where id = new.achievement_id;
  if not found then return new; end if;
  v_ko := coalesce(nullif(v_a.name_i18n->>'ko', ''), v_a.name_i18n->>'en', v_a.code);
  v_en := coalesce(nullif(v_a.name_i18n->>'en', ''), v_a.name_i18n->>'ko', v_a.code);
  if coalesce(v_a.point_reward, 0) > 0 then
    v_points := ' (+' || v_a.point_reward || ' P)';
  end if;

  -- 제목에 업적명 — 배너는 제목 한 줄만 보여 주므로 여기에 뱃지 이름이 있어야 한다.
  -- 한·영 이름이 같으면(코드 fallback 등) 한 번만 적는다.
  insert into member_notices (user_id, title, body, link_url, icon_url)
  values (
    new.user_id,
    '🏅 ' || case when v_ko = v_en then v_ko else v_ko || ' · ' || v_en end,
    '「' || v_ko || '」 뱃지를 받았어요!' || v_points || E'\n' ||
    'You earned the “' || v_en || '” badge!' || v_points || E'\n\n' ||
    '마이페이지 › 업적·뱃지 · My Page › Achievements & badges',
    'https://123band-web.vercel.app/account/badges',
    nullif(btrim(coalesce(v_a.badge_image_url, '')), '')
  )
  returning batch_id into v_batch;

  -- 웹푸시 — 닫아 둔 사람에게도. 수신 URL 은 쿠폰 웹훅 설정(notify.webhook, 0064)에서 경로만 바꿔 쓴다:
  -- 두 라우트가 같은 앱·같은 시크릿(NOTIFY_WEBHOOK_SECRET)이라 설정을 하나 더 두지 않는다.
  -- url 이 비어 있으면(로컬) 조용히 지나간다. 실패해도 알림 행은 이미 들어가 있다.
  begin
    select value into v_cfg from app_settings where key = 'notify.webhook';
    v_url := nullif(btrim(coalesce(v_cfg->>'url', '')), '');
    v_secret := coalesce(v_cfg->>'secret', '');
    if v_url is not null then
      v_url := regexp_replace(v_url, '/api/notify/[a-z-]+$', '/api/notify/member-notice');
      perform net.http_post(
        url := v_url,
        body := jsonb_build_object('batchId', v_batch),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
        timeout_milliseconds := 5000
      );
    end if;
  exception when others then
    raise warning '[notify_achievement_earned] 푸시 웹훅 실패: %', sqlerrm;
  end;

  return new;
exception when others then
  -- 알림이 실패해도 업적 지급은 막지 않는다.
  raise warning '[notify_achievement_earned] 알림 실패: %', sqlerrm;
  return new;
end;
$$;

notify pgrst, 'reload schema';
