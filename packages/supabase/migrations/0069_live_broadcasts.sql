-- 0069: 라이브 방송 — 유튜브 임베드 시청 + 영상감독 스위처 + 현장 탈리.
--
-- 123Band 가 담당하는 범위는 '어느 앵글을 내보낼지'를 기록·전달하는 것까지다.
-- 영상 자체는 현장 노트북의 OBS 가 받아 유튜브로 송출한다(123Band 서버에 영상은 도달하지 않는다).
--
--   live_broadcasts     방송 1건 = 유튜브 라이브 1개. 상태(scheduled→live→ended→archived)를 여기서 돌린다.
--     └ live_cameras       그 방송의 앵글 1~4. obs_scene_name 이 OBS 씬 이름과 1:1로 맞아야 한다.
--     └ live_switch_log    전환 기록(append-only). VOD 챕터링·클립 추출의 기준 데이터가 된다.
--     └ live_tally_tokens  탈리 화면(로그인 없이 여는 현장 화면) 접근 토큰.
--
-- 토큰을 방송 행에 두지 않는 이유: Realtime(postgres_changes)은 행 전체를 페이로드로 보낸다.
--   공개 페이지가 익명으로 구독하면 같은 행에 있는 토큰이 브라우저로 새어 나간다.
--   RLS 는 행 단위라 이걸 막지 못하므로, 토큰은 관리자만 읽는 별도 테이블에 두고
--   탈리 화면은 SECURITY DEFINER 함수(live_tally_state)로만 값을 받아간다.
-- idempotent.

-- ── 1) 방송 ──────────────────────────────────────────────────
create table if not exists live_broadcasts (
  id uuid primary key default gen_random_uuid(),
  -- 연결 행사(선택). 행사 = products(product_type='ticket'). 삭제돼도 방송 기록은 남는다.
  event_product_id uuid references products(id) on delete set null,
  slug text not null unique,                            -- 공개 URL: /{locale}/live/{slug}
  title_i18n jsonb not null default '{}'::jsonb,
  -- 유튜브 영상 ID 11자. URL 이 아니라 ID 만 저장한다(파싱은 어드민 폼에서).
  yt_video_id text check (yt_video_id is null or yt_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  backup_hls_url text,                                  -- 유튜브 장애 시 대체 HLS(.m3u8)
  active_source text not null default 'youtube' check (active_source in ('youtube', 'backup')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'ended', 'archived')),
  scheduled_at timestamptz,
  show_chat boolean not null default true,
  notice_i18n jsonb not null default '{}'::jsonb,       -- 시청자 배너 공지
  -- 현재 프로그램 카메라 / 직전 카메라(Space 토글용). FK 는 live_cameras 생성 뒤에 붙인다.
  program_camera_id uuid,
  previous_camera_id uuid,
  current_segment text,                                 -- 진행 순서. 예: '예선 3조'
  switch_mode text not null default 'a' check (switch_mode in ('a', 'b')),  -- a=지시, b=브리지
  bridge_status text not null default 'offline'
    check (bridge_status in ('offline', 'connected', 'error')),
  bridge_heartbeat_at timestamptz,
  bridge_error text,                                    -- 마지막 전환 실패 사유(스위처 상태바에 표시)
  obs_scenes jsonb,                                     -- 브리지가 올린 OBS 씬 이름 배열
  started_at timestamptz,                               -- live 전환 시각(경과 시간 표시용)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 소스 없이 방송을 켤 수 없다. 어드민 폼에서도 막지만 DB 가 최종 보증한다.
  constraint live_broadcasts_live_needs_source check (
    status <> 'live'
    or (active_source = 'youtube' and yt_video_id is not null)
    or (active_source = 'backup' and backup_hls_url is not null)
  )
);

create index if not exists live_broadcasts_event_idx on live_broadcasts (event_product_id);
create index if not exists live_broadcasts_status_idx on live_broadcasts (status, scheduled_at desc);

drop trigger if exists trg_live_broadcasts_updated on live_broadcasts;
create trigger trg_live_broadcasts_updated
  before update on live_broadcasts for each row execute function set_updated_at();

-- ── 2) 카메라(앵글) ──────────────────────────────────────────
create table if not exists live_cameras (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references live_broadcasts(id) on delete cascade,
  slot int not null check (slot between 1 and 4),       -- 스위처 단축키 1~4 와 같은 번호
  label text not null default '',                       -- 예: 메인무대 / 플로어 / 심사석 / 와이드
  obs_scene_name text not null default '',              -- OBS 씬 이름과 대소문자까지 정확히 일치
  operator_name text,
  device_note text,
  is_enabled boolean not null default true,
  health text not null default 'unknown' check (health in ('unknown', 'ok', 'warning', 'down')),
  health_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (broadcast_id, slot)
);

create index if not exists live_cameras_broadcast_idx on live_cameras (broadcast_id, slot);

-- 프로그램/직전 카메라 FK — 카메라가 지워지면 참조만 비운다(방송은 살아 있어야 한다).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'live_broadcasts_program_camera_fk') then
    alter table live_broadcasts
      add constraint live_broadcasts_program_camera_fk
      foreign key (program_camera_id) references live_cameras(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'live_broadcasts_previous_camera_fk') then
    alter table live_broadcasts
      add constraint live_broadcasts_previous_camera_fk
      foreign key (previous_camera_id) references live_cameras(id) on delete set null;
  end if;
end $$;

-- ── 3) 전환 로그 (append-only) ───────────────────────────────
-- slot/label 을 함께 박아 둔다: 카메라 행이 지워져도 "그때 몇 번 카메라였는지"가 남아야
-- 방송이 끝난 뒤 CSV 로 VOD 챕터를 만들 수 있다.
create table if not exists live_switch_log (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references live_broadcasts(id) on delete cascade,
  camera_id uuid references live_cameras(id) on delete set null,
  camera_slot int,
  camera_label text,
  segment text,                                         -- 전환 시점의 current_segment 스냅샷
  switched_at timestamptz not null default now(),
  switched_by uuid references profiles(id) on delete set null,
  mode text not null default 'a' check (mode in ('a', 'b')),
  result text not null default 'ok' check (result in ('ok', 'failed')),
  error text
);

create index if not exists live_switch_log_broadcast_idx
  on live_switch_log (broadcast_id, switched_at desc);

-- ── 4) 탈리 토큰 ─────────────────────────────────────────────
create table if not exists live_tally_tokens (
  broadcast_id uuid primary key references live_broadcasts(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

-- 방송을 만들면 토큰도 같이 생긴다 — 어드민이 따로 발급 버튼을 누를 필요가 없다.
create or replace function live_issue_tally_token() returns trigger as $$
begin
  insert into live_tally_tokens (broadcast_id) values (new.id)
  on conflict (broadcast_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = band123;

drop trigger if exists trg_live_broadcasts_tally_token on live_broadcasts;
create trigger trg_live_broadcasts_tally_token
  after insert on live_broadcasts for each row execute function live_issue_tally_token();

-- 이미 만들어져 있던 방송(재적용 시)에도 토큰을 채운다.
insert into live_tally_tokens (broadcast_id)
select id from live_broadcasts
on conflict (broadcast_id) do nothing;

-- ── 5) RLS ───────────────────────────────────────────────────
alter table live_broadcasts   enable row level security;
alter table live_cameras      enable row level security;
alter table live_switch_log   enable row level security;
alter table live_tally_tokens enable row level security;

-- 방송: 시청 가능한 상태만 공개. scheduled 는 관리자에게만 보인다(예고 유출 방지).
drop policy if exists "live_broadcasts_public_read" on live_broadcasts;
create policy "live_broadcasts_public_read" on live_broadcasts
  for select using (status in ('live', 'ended', 'archived') or is_admin());
drop policy if exists "live_broadcasts_admin_write" on live_broadcasts;
create policy "live_broadcasts_admin_write" on live_broadcasts
  for all using (is_admin()) with check (is_admin());

-- 카메라·로그·토큰은 운영 데이터다. 공개 읽기 없음(탈리는 아래 함수로만 읽는다).
drop policy if exists "live_cameras_admin" on live_cameras;
create policy "live_cameras_admin" on live_cameras
  for all using (is_admin()) with check (is_admin());
drop policy if exists "live_switch_log_admin" on live_switch_log;
create policy "live_switch_log_admin" on live_switch_log
  for all using (is_admin()) with check (is_admin());
drop policy if exists "live_tally_tokens_admin" on live_tally_tokens;
create policy "live_tally_tokens_admin" on live_tally_tokens
  for all using (is_admin()) with check (is_admin());

-- ── 6) 탈리 화면용 조회 함수 ─────────────────────────────────
-- 현장 노트북은 로그인 없이 이 화면을 띄운다. 토큰이 맞을 때만, 표시에 필요한 값만 내려준다.
-- (RLS 를 우회하므로 scheduled 상태의 리허설에서도 동작한다)
create or replace function live_tally_state(p_token text)
returns jsonb as $$
  select jsonb_build_object(
    'broadcast_id', b.id,
    'slug', b.slug,
    'status', b.status,
    'segment', b.current_segment,
    'switch_mode', b.switch_mode,
    'updated_at', b.updated_at,
    'program', case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'slot', c.slot, 'label', c.label, 'operator_name', c.operator_name
    ) end
  )
  from live_tally_tokens t
  join live_broadcasts b on b.id = t.broadcast_id
  left join live_cameras c on c.id = b.program_camera_id
  where t.token = p_token
    and length(coalesce(p_token, '')) >= 16;   -- 빈 토큰/짧은 추측 차단
$$ language sql security definer stable set search_path = band123;

revoke all on function live_tally_state(text) from public;
grant execute on function live_tally_state(text) to anon, authenticated;

-- ── 7) Realtime ──────────────────────────────────────────────
-- 시청자 화면과 스위처·탈리가 새로고침 없이 따라오게 한다. RLS 는 그대로 적용된다.
-- (토큰은 이 테이블에 없으므로 페이로드로 새어 나갈 비밀이 없다)
do $$
begin
  alter publication supabase_realtime add table band123.live_broadcasts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

comment on table live_broadcasts is '라이브 방송 1건 = 유튜브 라이브 1개. 상태·소스·현재 앵글·공지를 여기서 돌린다.';
comment on table live_cameras is '방송의 앵글 1~4. obs_scene_name 은 OBS 씬 이름과 정확히 일치해야 한다.';
comment on table live_switch_log is '앵글 전환 기록(append-only). VOD 챕터링·클립 추출 기준 데이터.';
comment on table live_tally_tokens is '탈리 화면(로그인 없는 현장 화면) 접근 토큰. 관리자만 조회 가능.';
