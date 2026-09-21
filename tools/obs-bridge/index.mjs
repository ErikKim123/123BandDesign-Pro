// 123Band OBS 브리지 — 스위처의 앵글 지시를 받아 현장 OBS 의 씬을 바꾼다. (모드 B)
//
//   123Band 스위처에서 카메라 선택
//     → Supabase live_broadcasts.program_camera_id 갱신
//     → 이 스크립트가 1초마다 확인
//     → obs-websocket 의 SetCurrentProgramScene 호출
//     → OBS 씬 전환
//
// 이 스크립트가 죽어도 방송은 멈추지 않는다. 모드 A(탈리 화면 보고 오퍼레이터가 수동 전환)로
// 계속 진행하면 된다. 그래서 여기서는 실패해도 조용히 재시도하고, 상태만 정직하게 보고한다.
//
// 참고: OBS 커스텀 브라우저 독의 window.obsstudio 로는 씬을 바꿀 수 없다(메서드 호출이 동작하지 않는다).
//       그래서 obs-websocket 을 쓴다.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OBSWebSocket from 'obs-websocket-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const FIELD_TOKEN = process.env.BAND_FIELD_TOKEN ?? '';
const OBS_URL = process.env.OBS_URL ?? 'ws://127.0.0.1:4455';
const OBS_PASSWORD = process.env.OBS_PASSWORD ?? '';
const POLL_MS = Number(process.env.POLL_MS ?? 1000);
const HEALTH_MS = Number(process.env.HEALTH_MS ?? 10000);

// ── 사람이 읽는 로그 (현장에서 이 창을 띄워 놓고 본다) ──────────
const stamp = () => new Date().toTimeString().slice(0, 8);
const log = (msg) => console.log(`[${stamp()}] ${msg}`);
const warn = (msg) => console.log(`[${stamp()}] ⚠ ${msg}`);
const ok = (msg) => console.log(`[${stamp()}] ✓ ${msg}`);

function requireEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!FIELD_TOKEN) missing.push('BAND_FIELD_TOKEN');
  if (missing.length) {
    console.log('');
    console.log('설정이 비어 있습니다: ' + missing.join(', '));
    console.log('.env.example 을 .env 로 복사한 뒤 값을 채워 주세요.');
    console.log('');
    process.exit(1);
  }
}
requireEnv();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'band123' }, // 123Band 테이블·RPC 는 band123 스키마에 있다
  auth: { persistSession: false },
});
const obs = new OBSWebSocket();

let obsConnected = false;
let currentScene = null; // 우리가 마지막으로 맞춘 씬
let lastProgramId = null; // 마지막으로 처리한 지시
let stopping = false;

/** Supabase RPC 한 번 — 실패해도 던지지 않는다(현장에서 스크립트가 죽으면 안 된다). */
async function rpc(fn, args) {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      warn(`${fn} 실패: ${error.message}`);
      return null;
    }
    return data;
  } catch (e) {
    warn(`${fn} 실패: ${e?.message ?? e}`);
    return null;
  }
}

// ── OBS 연결 (지수 백오프 재접속) ────────────────────────────
let backoff = 1000;

async function connectObs() {
  if (stopping) return;
  try {
    await obs.connect(OBS_URL, OBS_PASSWORD || undefined);
    obsConnected = true;
    backoff = 1000;
    ok(`OBS 에 연결했습니다 (${OBS_URL})`);
    await publishScenes();
  } catch (e) {
    obsConnected = false;
    warn(`OBS 연결 실패: ${e?.message ?? e} — ${Math.round(backoff / 1000)}초 뒤 다시 시도합니다`);
    setTimeout(connectObs, backoff);
    backoff = Math.min(backoff * 2, 30000); // 최대 30초 간격
  }
}

obs.on('ConnectionClosed', () => {
  if (!obsConnected || stopping) return;
  obsConnected = false;
  currentScene = null;
  warn('OBS 연결이 끊겼습니다. 재접속을 시도합니다.');
  void rpc('live_bridge_report', {
    p_token: FIELD_TOKEN,
    p_ok: false,
    p_error: 'OBS 연결 끊김',
  });
  setTimeout(connectObs, backoff);
});

/** 시작할 때(그리고 재접속할 때) OBS 의 씬 목록을 123Band 에 올린다 — 어드민 드롭다운이 이걸 쓴다. */
async function publishScenes() {
  try {
    const { scenes, currentProgramSceneName } = await obs.call('GetSceneList');
    const names = (scenes ?? []).map((s) => s.sceneName);
    currentScene = currentProgramSceneName ?? null;
    const res = await rpc('live_bridge_hello', { p_token: FIELD_TOKEN, p_scenes: names });
    if (res?.ok === false) {
      warn(`123Band 가 토큰을 받아들이지 않았습니다: ${res.error} — .env 의 BAND_FIELD_TOKEN 을 확인하세요`);
      return;
    }
    ok(`씬 ${names.length}개를 123Band 에 등록했습니다: ${names.join(', ')}`);
    const cams = res?.cameras ?? [];
    for (const c of cams) {
      if (c.obs_scene_name && !names.includes(c.obs_scene_name)) {
        warn(`카메라 ${c.slot}(${c.label})의 씬 "${c.obs_scene_name}" 이 OBS 에 없습니다`);
      }
    }
  } catch (e) {
    warn(`씬 목록을 읽지 못했습니다: ${e?.message ?? e}`);
  }
}

// ── 지시 확인 → 씬 전환 ──────────────────────────────────────
async function tick() {
  const state = await rpc('live_bridge_state', { p_token: FIELD_TOKEN });
  if (!state || state.ok === false) return;

  const program = state.program;
  if (!program) return;
  if (program.id === lastProgramId) return; // 같은 지시 — 아무것도 하지 않는다

  lastProgramId = program.id;
  const scene = (program.obs_scene_name ?? '').trim();
  log(`지시: ${program.slot}번 ${program.label}${scene ? ` → 씬 "${scene}"` : ''}`);

  if (state.switch_mode !== 'b') {
    log('모드 A(수동)이라 씬을 바꾸지 않습니다. 탈리 화면을 보고 전환하세요.');
    return;
  }
  if (!scene) {
    await rpc('live_bridge_report', {
      p_token: FIELD_TOKEN,
      p_ok: false,
      p_error: `카메라 ${program.slot} 에 OBS 씬 이름이 없습니다`,
    });
    warn(`카메라 ${program.slot} 에 OBS 씬 이름이 지정돼 있지 않습니다`);
    return;
  }
  if (!obsConnected) {
    await rpc('live_bridge_report', {
      p_token: FIELD_TOKEN,
      p_ok: false,
      p_error: 'OBS 에 연결돼 있지 않습니다',
    });
    return;
  }

  try {
    await obs.call('SetCurrentProgramScene', { sceneName: scene });
    currentScene = scene;
    ok(`씬을 "${scene}" 로 바꿨습니다`);
    await rpc('live_bridge_report', { p_token: FIELD_TOKEN, p_ok: true, p_error: null });
  } catch (e) {
    const msg = e?.message ?? String(e);
    warn(`씬 전환 실패: ${msg}`);
    await rpc('live_bridge_report', { p_token: FIELD_TOKEN, p_ok: false, p_error: msg });
  }
}

// ── 카메라 상태 보고 (best effort) ───────────────────────────
// 씬 안의 미디어 소스(SRT/ffmpeg)가 오류·종료 상태면 신호가 끊긴 것으로 본다.
// 미디어 소스가 없는 씬(정지 이미지 등)은 판단하지 않는다 — 감독의 수동 표시를 덮어쓰지 않기 위해서다.
async function reportHealth() {
  if (!obsConnected) return;
  const state = await rpc('live_bridge_state', { p_token: FIELD_TOKEN });
  if (!state || state.ok === false) return;

  const hello = await rpc('live_bridge_hello', {
    p_token: FIELD_TOKEN,
    p_scenes: await sceneNames(),
  });
  for (const cam of hello?.cameras ?? []) {
    const scene = (cam.obs_scene_name ?? '').trim();
    if (!scene) continue;
    let verdict = null;
    try {
      const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: scene });
      for (const item of sceneItems ?? []) {
        if (!/ffmpeg_source|vlc_source/.test(item.inputKind ?? '')) continue;
        const st = await obs.call('GetMediaInputStatus', { inputName: item.sourceName });
        const s = st?.mediaState ?? '';
        if (s === 'OBS_MEDIA_STATE_PLAYING') verdict = 'ok';
        else if (s === 'OBS_MEDIA_STATE_ERROR' || s === 'OBS_MEDIA_STATE_ENDED') verdict = 'down';
      }
    } catch {
      verdict = null; // 씬이 없거나 조회 실패 — 판단하지 않는다
    }
    if (verdict) {
      await rpc('live_bridge_camera_health', {
        p_token: FIELD_TOKEN,
        p_slot: cam.slot,
        p_health: verdict,
      });
    }
  }
}

async function sceneNames() {
  try {
    const { scenes } = await obs.call('GetSceneList');
    return (scenes ?? []).map((s) => s.sceneName);
  } catch {
    return [];
  }
}

// ── 시작 ─────────────────────────────────────────────────────
console.log('');
console.log('  123Band OBS 브리지');
console.log(`  OBS: ${OBS_URL}`);
console.log(`  확인 주기: ${POLL_MS}ms`);
console.log('  종료하려면 Ctrl+C — 종료해도 방송은 계속됩니다(모드 A 로 진행하세요).');
console.log('');

await connectObs();
const pollTimer = setInterval(() => void tick(), POLL_MS);
const healthTimer = setInterval(() => void reportHealth(), HEALTH_MS);

function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(pollTimer);
  clearInterval(healthTimer);
  log('브리지를 종료합니다. 스위처에는 잠시 뒤 "끊김"으로 표시됩니다.');
  void obs.disconnect().catch(() => {});
  setTimeout(() => process.exit(0), 200);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
