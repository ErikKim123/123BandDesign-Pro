-- 0070: OBS 브리지용 RPC — 현장 노트북이 서비스 키 없이 안전하게 붙는 통로.
--
-- 배경: 브리지(tools/obs-bridge)는 현장 노트북에서 도는 작은 Node 스크립트다.
--   live_broadcasts 의 쓰기 정책은 is_admin() 인데 브리지에는 관리자 세션이 없다.
--   그렇다고 서비스 롤 키를 현장 노트북에 두면 그 키로 DB 전체가 열린다.
--   → 방송 1건에만 권한이 묶인 '현장 토큰'(live_tally_tokens.token, 탈리 화면과 같은 토큰)으로
--     아래 네 가지 동작만 할 수 있게 SECURITY DEFINER 함수를 연다.
--
-- 브리지가 할 수 있는 일: 씬 목록 등록 / 현재 지시 조회(+하트비트) / 전환 결과 보고 / 카메라 상태 보고.
-- 그 외에는 아무것도 못 한다. 방송 상태 전환·삭제는 어드민만 한다.
-- idempotent.

-- 토큰 → 방송 id (내부 헬퍼). 짧은 토큰은 즉시 거른다.
create or replace function live_broadcast_by_token(p_token text)
returns uuid as $$
  select t.broadcast_id
  from live_tally_tokens t
  where t.token = p_token
    and length(coalesce(p_token, '')) >= 16;
$$ language sql security definer stable set search_path = band123;

revoke all on function live_broadcast_by_token(text) from public;

-- ── 1) 접속 인사 — OBS 씬 목록을 올린다 ─────────────────────
-- 어드민 카메라 등록 화면이 이 목록으로 드롭다운을 만든다(씬 이름 오타 = 사고).
create or replace function live_bridge_hello(p_token text, p_scenes jsonb)
returns jsonb as $$
declare
  v_id uuid;
begin
  v_id := live_broadcast_by_token(p_token);
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  update live_broadcasts
     set obs_scenes = p_scenes,
         bridge_status = 'connected',
         bridge_heartbeat_at = now(),
         bridge_error = null
   where id = v_id;

  return jsonb_build_object(
    'ok', true,
    'broadcast_id', v_id,
    'cameras', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slot', c.slot, 'label', c.label, 'obs_scene_name', c.obs_scene_name,
        'is_enabled', c.is_enabled
      ) order by c.slot)
      from live_cameras c where c.broadcast_id = v_id
    ), '[]'::jsonb)
  );
end;
$$ language plpgsql security definer set search_path = band123;

-- ── 2) 현재 지시 조회 (+ 하트비트) ───────────────────────────
-- 브리지는 이 함수를 1초마다 부른다. 호출 자체가 '살아 있음' 신호라 별도 하트비트가 필요 없다.
create or replace function live_bridge_state(p_token text)
returns jsonb as $$
declare
  v_id uuid;
  v_row jsonb;
begin
  v_id := live_broadcast_by_token(p_token);
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  update live_broadcasts
     set bridge_heartbeat_at = now(),
         -- 오류 상태는 브리지가 성공을 보고할 때까지 유지한다(스위처에서 원인을 봐야 하므로).
         bridge_status = case when bridge_status = 'error' then 'error' else 'connected' end
   where id = v_id;

  select jsonb_build_object(
    'ok', true,
    'broadcast_id', b.id,
    'status', b.status,
    'switch_mode', b.switch_mode,
    'segment', b.current_segment,
    'updated_at', b.updated_at,
    'program', case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'slot', c.slot, 'label', c.label,
      'obs_scene_name', c.obs_scene_name, 'is_enabled', c.is_enabled
    ) end
  ) into v_row
  from live_broadcasts b
  left join live_cameras c on c.id = b.program_camera_id
  where b.id = v_id;

  return v_row;
end;
$$ language plpgsql security definer set search_path = band123;

-- ── 3) 전환 결과 보고 ────────────────────────────────────────
-- 성공이면 오류를 지우고, 실패면 사유를 남기고 가장 최근 전환 로그를 failed 로 정정한다.
-- (스위처는 명령을 낸 시점에 ok 로 기록한다 — 실제 OBS 결과는 브리지만 알 수 있다)
create or replace function live_bridge_report(p_token text, p_ok boolean, p_error text default null)
returns jsonb as $$
declare
  v_id uuid;
begin
  v_id := live_broadcast_by_token(p_token);
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  update live_broadcasts
     set bridge_status = case when p_ok then 'connected' else 'error' end,
         bridge_error = case when p_ok then null else left(coalesce(p_error, 'unknown'), 500) end,
         bridge_heartbeat_at = now()
   where id = v_id;

  if not p_ok then
    update live_switch_log
       set result = 'failed',
           error = left(coalesce(p_error, 'unknown'), 500)
     where id = (
       select id from live_switch_log
       where broadcast_id = v_id
       order by switched_at desc
       limit 1
     );
  end if;

  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer set search_path = band123;

-- ── 4) 카메라 상태 보고 (모드 B) ─────────────────────────────
-- 브리지가 OBS 소스 활성 상태를 보고 신호 끊김을 알린다. 모드 A 에서는 감독이 손으로 바꾼다.
create or replace function live_bridge_camera_health(p_token text, p_slot int, p_health text)
returns jsonb as $$
declare
  v_id uuid;
begin
  v_id := live_broadcast_by_token(p_token);
  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if p_health not in ('unknown', 'ok', 'warning', 'down') then
    return jsonb_build_object('ok', false, 'error', 'invalid_health');
  end if;

  update live_cameras
     set health = p_health,
         health_updated_at = now()
   where broadcast_id = v_id and slot = p_slot;

  return jsonb_build_object('ok', true);
end;
$$ language plpgsql security definer set search_path = band123;

-- 현장 노트북은 로그인하지 않는다 → anon 으로 실행한다. 토큰이 없으면 아무것도 못 한다.
revoke all on function live_bridge_hello(text, jsonb) from public;
revoke all on function live_bridge_state(text) from public;
revoke all on function live_bridge_report(text, boolean, text) from public;
revoke all on function live_bridge_camera_health(text, int, text) from public;
grant execute on function live_bridge_hello(text, jsonb) to anon, authenticated;
grant execute on function live_bridge_state(text) to anon, authenticated;
grant execute on function live_bridge_report(text, boolean, text) to anon, authenticated;
grant execute on function live_bridge_camera_health(text, int, text) to anon, authenticated;
