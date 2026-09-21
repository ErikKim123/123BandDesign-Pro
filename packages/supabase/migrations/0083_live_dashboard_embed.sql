-- 0083: 라이브 섹션에 '진행 대시보드' 화면 끼워 넣기.
--
-- 배경: 현장에는 대회 진행 상태를 띄우는 별도 대시보드가 있다(라운드·단계·PREPARING 같은 안내
--   화면). 현장 관객은 무대 스크린으로 그걸 보는데, 온라인 시청자는 유튜브 화면만 봐서
--   "지금 어느 라운드인지"를 알 방법이 없었다. 방송이 잠시 멈춘 사이(공지 배너만 뜨는 구간)
--   특히 그렇다.
--   → 방송에 대시보드 주소를 붙여, 라이브 섹션 안에서 영상 아래에 같이 띄운다.
--
-- 왜 주소를 DB 에 두는가: 대시보드는 이 레포가 아닌 별도 앱이고, 대회마다 주소가 다르다
--   (…/dashboard/{contestId}?round=…). 코드에 박으면 대회가 바뀔 때마다 배포해야 한다.
--   방송 행에 얹어 두면 어드민이 현장에서 바꾼다.
--
-- 노출 스위치를 따로 두는 이유(show_dashboard): 주소를 지우지 않고 껐다 켤 수 있어야 한다.
--   대시보드가 아직 준비 안 된 구간에는 끄고, 준비되면 켠다 — show_chat 과 같은 결.
-- idempotent.

alter table live_broadcasts
  add column if not exists dashboard_url text,
  add column if not exists show_dashboard boolean not null default false,
  add column if not exists dashboard_label_i18n jsonb not null default '{}'::jsonb,
  add column if not exists dashboard_refresh_sec integer not null default 0;

comment on column live_broadcasts.dashboard_url is
  '라이브 섹션에 끼워 넣을 진행 대시보드 주소(https). 별도 앱의 화면을 iframe 으로 띄운다.';
comment on column live_broadcasts.show_dashboard is
  '대시보드 노출 스위치. 주소를 남겨 둔 채 껐다 켤 수 있다.';
comment on column live_broadcasts.dashboard_label_i18n is
  '대시보드 위에 다는 설명(예: 실시간 진행 현황). 비우면 기본 문구를 쓴다.';
comment on column live_broadcasts.dashboard_refresh_sec is
  '대시보드 자동 새로고침 주기(초). 0 이면 새로고침하지 않는다. 남의 화면이라 내용 변화를 알 수 없어, 주기적으로 다시 불러 최신 상태를 따라간다.';

-- 주소는 https 만 — 시청 화면은 https 이고, http 프레임은 브라우저가 막는다(mixed content).
-- 사람이 어드민에 "jnj-dash.vercel.app" 처럼 스킴 없이 넣는 것도 여기서 걸린다.
alter table live_broadcasts
  drop constraint if exists live_broadcasts_dashboard_url_https;
alter table live_broadcasts
  add constraint live_broadcasts_dashboard_url_https
  check (dashboard_url is null or dashboard_url ~ '^https://');

-- 새로고침 주기는 0(끔) 또는 10초 이상. 그보다 짧으면 남의 서버를 두드리는 꼴이 되고,
-- 프레임이 계속 깜빡여 읽을 수가 없다.
alter table live_broadcasts
  drop constraint if exists live_broadcasts_dashboard_refresh_range;
alter table live_broadcasts
  add constraint live_broadcasts_dashboard_refresh_range
  check (dashboard_refresh_sec = 0 or dashboard_refresh_sec between 10 and 3600);
