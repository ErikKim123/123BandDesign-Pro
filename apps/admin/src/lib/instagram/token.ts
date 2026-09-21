// 인스타그램 액세스 토큰 저장소 — app_settings['sns.instagram'] 한 곳에서만 관리한다.
// 목적: 관리자가 토큰을 "한 번" 넣으면 끝. 짧은 수명 토큰은 저장 시점에 60일 장기 토큰으로 교환하고,
// 만료가 가까워지면 갱신해 다시 60일로 늘린다(cron: /api/settings/instagram/refresh).
// ⚠️ 서버 전용. service_role 로 읽고 쓰므로 브라우저 번들에 포함되면 안 된다.
import { DB_SCHEMA } from '@123band/shared/supabase/schema';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const IG_KEY = 'sns.instagram';
const GRAPH = 'https://graph.facebook.com/v21.0';

// 만료까지 이 기간보다 적게 남으면 갱신 대상.
const REFRESH_WINDOW_DAYS = 14;

export interface IgSetting {
  handle: string;
  token: string;
  /** ISO 8601. 만료 시각을 모르면(=교환 없이 저장된 토큰) null. */
  expiresAt: string | null;
  /** 장기 토큰 교환에 성공해 저장된 값인지. */
  longLived: boolean;
  /** 마지막으로 교환·갱신한 시각(ISO). */
  refreshedAt: string | null;
}

/** service_role 클라이언트 — RLS 우회. 인스타 관련 서버 코드가 공유한다(cron 은 세션이 없다). */
export function igAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { db: { schema: DB_SCHEMA }, auth: { autoRefreshToken: false, persistSession: false } });
}

/** 저장된 인스타 설정을 읽는다. 행이 없거나 값이 비어 있으면 빈 설정. */
export async function readIgSetting(): Promise<IgSetting> {
  const { data, error } = await igAdminClient()
    .from('app_settings')
    .select('value')
    .eq('key', IG_KEY)
    .maybeSingle();
  if (error) throw new Error(`설정을 불러오지 못했습니다: ${error.message}`);

  const v = (data?.value ?? {}) as Partial<IgSetting>;
  return {
    handle: typeof v.handle === 'string' ? v.handle : '',
    token: typeof v.token === 'string' ? v.token : '',
    expiresAt: typeof v.expiresAt === 'string' ? v.expiresAt : null,
    longLived: v.longLived === true,
    refreshedAt: typeof v.refreshedAt === 'string' ? v.refreshedAt : null,
  };
}

async function writeIgSetting(value: IgSetting): Promise<void> {
  const { error } = await igAdminClient()
    .from('app_settings')
    .upsert({ key: IG_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`설정을 저장하지 못했습니다: ${error.message}`);
}

function metaAppCreds(): { id: string; secret: string } | null {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  return id && secret ? { id, secret } : null;
}

/**
 * 짧은 수명 토큰 → 60일 장기 토큰 교환. 장기 토큰을 다시 넣으면 만료가 60일로 연장되므로
 * 최초 저장과 주기적 갱신이 같은 호출을 쓴다.
 * App ID/Secret 미설정이면 교환하지 않고 null 을 돌려준다(입력한 토큰을 그대로 저장).
 */
async function exchangeForLongLived(
  token: string,
): Promise<{ token: string; expiresAt: string | null } | { error: string } | null> {
  const creds = metaAppCreds();
  if (!creds) return null;

  const url =
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(creds.id)}` +
    `&client_secret=${encodeURIComponent(creds.secret)}` +
    `&fb_exchange_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !json.access_token) {
    return { error: json.error?.message || '장기 토큰 교환에 실패했습니다. 토큰/앱 설정을 확인하세요.' };
  }
  // expires_in 이 없으면 만료 없는 토큰(페이지 토큰 등) — 만료 시각 미상으로 둔다.
  const expiresAt =
    typeof json.expires_in === 'number' && json.expires_in > 0
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null;
  return { token: json.access_token, expiresAt };
}

/**
 * 관리자 저장 처리. token 이 비어 있으면 기존 토큰을 유지하고 handle 만 바꾼다.
 * 새 토큰이 들어오면 장기 토큰으로 교환해 저장한다.
 */
export async function saveIgSetting(input: {
  handle: string;
  token: string;
}): Promise<{ setting: IgSetting; exchanged: boolean; warning?: string }> {
  const prev = await readIgSetting();
  const handle = input.handle.trim();
  const raw = input.token.trim();

  // 토큰 입력이 비어 있음 → 핸들만 갱신(기존 토큰/만료 정보 보존)
  if (!raw) {
    const setting = { ...prev, handle };
    await writeIgSetting(setting);
    return { setting, exchanged: false };
  }

  const exchange = await exchangeForLongLived(raw);

  if (exchange === null) {
    // App ID/Secret 미설정 — 입력값 그대로 저장하되 자동 갱신이 불가함을 알린다.
    const setting: IgSetting = {
      handle,
      token: raw,
      expiresAt: null,
      longLived: false,
      refreshedAt: new Date().toISOString(),
    };
    await writeIgSetting(setting);
    return {
      setting,
      exchanged: false,
      warning:
        'META_APP_ID / META_APP_SECRET 이 설정되지 않아 장기 토큰으로 교환하지 못했습니다. 이 토큰은 만료되면 다시 발급해야 합니다.',
    };
  }

  if ('error' in exchange) throw new Error(exchange.error);

  const setting: IgSetting = {
    handle,
    token: exchange.token,
    expiresAt: exchange.expiresAt,
    longLived: true,
    refreshedAt: new Date().toISOString(),
  };
  await writeIgSetting(setting);
  return { setting, exchanged: true };
}

/** 만료까지 남은 일수. 만료 시각을 모르면 null. */
export function daysUntilExpiry(setting: IgSetting): number | null {
  if (!setting.expiresAt) return null;
  const ms = new Date(setting.expiresAt).getTime() - Date.now();
  return Math.floor(ms / 86_400_000);
}

/**
 * 만료가 가까우면 갱신한다. cron 과 게시 직전 점검에서 공용으로 쓴다.
 * 반환: 실제로 갱신했는지 + 사유.
 */
export async function refreshIgTokenIfNeeded(
  opts: { force?: boolean } = {},
): Promise<{ refreshed: boolean; reason: string; expiresAt: string | null }> {
  const setting = await readIgSetting();
  if (!setting.token) return { refreshed: false, reason: '저장된 토큰이 없습니다.', expiresAt: null };
  if (!metaAppCreds()) {
    return { refreshed: false, reason: 'META_APP_ID / META_APP_SECRET 미설정.', expiresAt: setting.expiresAt };
  }

  const left = daysUntilExpiry(setting);
  if (!opts.force && left !== null && left > REFRESH_WINDOW_DAYS) {
    return { refreshed: false, reason: `아직 ${left}일 남아 갱신 불필요.`, expiresAt: setting.expiresAt };
  }

  const exchange = await exchangeForLongLived(setting.token);
  if (exchange === null) {
    return { refreshed: false, reason: 'META_APP_ID / META_APP_SECRET 미설정.', expiresAt: setting.expiresAt };
  }
  if ('error' in exchange) {
    // 갱신 실패 시 기존 토큰은 그대로 둔다(덮어써서 잃지 않도록).
    return { refreshed: false, reason: `갱신 실패: ${exchange.error}`, expiresAt: setting.expiresAt };
  }

  await writeIgSetting({
    ...setting,
    token: exchange.token,
    expiresAt: exchange.expiresAt,
    longLived: true,
    refreshedAt: new Date().toISOString(),
  });
  return { refreshed: true, reason: '갱신 완료.', expiresAt: exchange.expiresAt };
}
