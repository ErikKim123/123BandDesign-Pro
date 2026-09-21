-- 0109: 회원 알림 — 사이트 언어에 맞춰 한국어/영어 따로
--
-- 지금까지 알림은 제목·본문 한 벌에 한·영을 같이 적었다(0080·0106). EN 모드 회원에게도 한국어가
-- 먼저 보이는 게 문제라 영어 판(title_en · body_en)을 따로 둔다. 영어 판이 없으면(예전 알림·
-- 운영자가 영어를 안 적은 공지) 기존 제목·본문을 그대로 보여 준다 — 그래서 nullable.
-- (1) 업적 알림 트리거: 제목·본문을 한국어만, 영어 판을 따로 채운다.
-- (2) send_member_notice: 영어 제목·본문(선택)을 받는다. 인자가 늘어 예전 서명은 지운다(PostgREST 오버로드 모호성).
-- idempotent.

alter table band123.member_notices add column if not exists title_en text;
alter table band123.member_notices add column if not exists body_en  text;
comment on column band123.member_notices.title_en is '영어 제목(선택). 회원 사이트 언어가 EN 이면 이걸 보여 준다. null → title.';
comment on column band123.member_notices.body_en  is '영어 본문(선택). null → body.';

-- ── 1) 업적 알림 ────────────────────────────────────────────────────────────────
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

  insert into member_notices (user_id, title, body, title_en, body_en, link_url, icon_url)
  values (
    new.user_id,
    '🏅 새 뱃지 · ' || v_ko,
    '「' || v_ko || '」 뱃지를 받았어요!' || v_points || E'\n' || '마이페이지 › 업적·뱃지에서 확인하세요.',
    '🏅 New badge · ' || v_en,
    'You earned the “' || v_en || '” badge!' || v_points || E'\n' || 'See it in My Page › Achievements & badges.',
    'https://123band-web.vercel.app/account/badges',
    nullif(btrim(coalesce(v_a.badge_image_url, '')), '')
  )
  returning batch_id into v_batch;

  -- 웹푸시(0107) — notify.webhook 설정의 경로만 바꿔 같은 앱·같은 시크릿으로 부른다.
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
  raise warning '[notify_achievement_earned] 알림 실패: %', sqlerrm;
  return new;
end;
$$;

-- ── 2) 운영자 발송 ──────────────────────────────────────────────────────────────
drop function if exists band123.send_member_notice(text, text, text, uuid[]);
create or replace function band123.send_member_notice(
  p_title text,
  p_body text,
  p_link text default null,
  p_user_ids uuid[] default null,
  p_title_en text default null,
  p_body_en text default null
)
returns jsonb
language plpgsql
security definer
set search_path = band123
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body  text := btrim(coalesce(p_body, ''));
  v_link  text := nullif(btrim(coalesce(p_link, '')), '');
  v_title_en text := nullif(btrim(coalesce(p_title_en, '')), '');
  v_body_en  text := nullif(btrim(coalesce(p_body_en, '')), '');
  v_n int;
begin
  if not is_admin() then
    raise exception '관리자만 알림을 보낼 수 있습니다.' using errcode = '42501';
  end if;
  if v_title = '' or v_body = '' then
    raise exception '제목과 내용을 입력해 주세요.' using errcode = '22023';
  end if;
  -- 영어는 제목·본문 둘 다 있어야 영어 판으로 친다. 한쪽만 있으면 EN 회원에게 반쪽이 보인다.
  if v_title_en is null or v_body_en is null then
    v_title_en := null; v_body_en := null;
  end if;

  insert into band123.member_notices (user_id, batch_id, title, body, title_en, body_en, link_url, created_by)
  select p.id, v_batch, v_title, v_body, v_title_en, v_body_en, v_link, auth.uid()
    from band123.profiles p
   where case
           when p_user_ids is null
             then p.role = 'customer' and coalesce(p.email, '') not like '%@deleted.invalid'
           else p.id = any(p_user_ids)
         end;
  get diagnostics v_n = row_count;

  return jsonb_build_object('batch_id', v_batch, 'sent', v_n);
end;
$$;
revoke all on function band123.send_member_notice(text, text, text, uuid[], text, text) from public;
grant execute on function band123.send_member_notice(text, text, text, uuid[], text, text) to authenticated;

notify pgrst, 'reload schema';

-- ── 3) 이미 들어간 업적 알림(0106·0107, 한·영 혼합) 정리 ──────────────────────────
-- 본문 첫 줄 「업적명」 으로 업적을 되찾아 한국어/영어 판으로 다시 쓴다. 운영자 공지(created_by 있음)는 건드리지 않는다.
update band123.member_notices n
   set title    = '🏅 새 뱃지 · ' || coalesce(nullif(a.name_i18n->>'ko', ''), a.name_i18n->>'en', a.code),
       body     = '「' || coalesce(nullif(a.name_i18n->>'ko', ''), a.name_i18n->>'en', a.code) || '」 뱃지를 받았어요!'
                  || case when coalesce(a.point_reward, 0) > 0 then ' (+' || a.point_reward || ' P)' else '' end
                  || E'\n' || '마이페이지 › 업적·뱃지에서 확인하세요.',
       title_en = '🏅 New badge · ' || coalesce(nullif(a.name_i18n->>'en', ''), a.name_i18n->>'ko', a.code),
       body_en  = 'You earned the “' || coalesce(nullif(a.name_i18n->>'en', ''), a.name_i18n->>'ko', a.code) || '” badge!'
                  || case when coalesce(a.point_reward, 0) > 0 then ' (+' || a.point_reward || ' P)' else '' end
                  || E'\n' || 'See it in My Page › Achievements & badges.',
       icon_url = coalesce(n.icon_url, nullif(btrim(coalesce(a.badge_image_url, '')), ''))
  from band123.achievements a
 where n.created_by is null
   and n.title_en is null
   and n.link_url = 'https://123band-web.vercel.app/account/badges'
   and n.body like '「' || coalesce(nullif(a.name_i18n->>'ko', ''), a.name_i18n->>'en', a.code) || '」%';
