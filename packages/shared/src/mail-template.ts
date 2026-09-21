import { DB_SCHEMA } from './supabase/schema';
// 메일 템플릿 — 어드민 '메일링 관리'에서 문구를 고치면 실제 발송에 반영된다.
//
// 설계 원칙 하나: 템플릿은 '있으면 쓰고 없으면 코드로 돌아간다'.
//   메일 문구를 DB 로 옮기면 DB 장애·오타·행 삭제가 곧바로 '메일이 안 나감'이 된다.
//   결제확정·가입 같은 경로에서 그건 허용할 수 없어서, 조회 실패/비활성/미등록은 전부
//   기존 하드코딩 본문으로 폴백한다. 관리 화면은 문구를 바꾸는 곳이지 발송을 끊는 곳이 아니다.
//
// 문법은 Mustache 의 최소 부분집합만 쓴다 — 운영자가 배울 것이 적고, 임의 코드 실행이 없다.
//   {{이름}}            값 치환 (HTML 이스케이프)
//   {{{이름}}}          값 치환 (이스케이프 안 함 — 이미 HTML 인 조각용)
//   {{#조건}}…{{/조건}}  값이 참이면 블록 출력. 배열이면 항목마다 반복.
//   {{^조건}}…{{/조건}}  값이 거짓/빈 배열이면 블록 출력.
// 반복 블록 안에서는 항목의 필드를 {{name}} 처럼 그대로 쓴다.

export type MailAudience = 'admin' | 'user';

/** 템플릿에서 쓸 수 있는 변수 한 개의 정의 — 어드민 화면의 안내와 미리보기 표본값. */
export interface MailVariable {
  name: string;
  label: string;
  /** 미리보기·테스트 발송에 쓸 예시 값. 배열이면 반복 블록용. */
  sample?: unknown;
  /**
   * 언어별 예시 값 — 고객 메일처럼 본문이 ko/en 로 갈리는데 값도 같이 갈려야 할 때.
   * 상품명이 대표적이다: 실제 발송은 구매자 언어로 상품명을 다시 뽑지만, 예시값이 한 벌뿐이면
   * EN 미리보기에 한국어 상품명이 박혀 '영문 메일이 깨진 것처럼' 보인다.
   * 해당 언어 값이 없으면 sample 로 폴백한다.
   */
  sampleI18n?: Record<string, unknown> | null;
}

export interface MailTemplate {
  key: string;
  name: string;
  audience: MailAudience;
  description?: string | null;
  /** 운영자 메일(한국어 고정) */
  subject?: string | null;
  body_html?: string | null;
  /** 구매자 메일(ko/en) */
  subject_i18n?: Record<string, string> | null;
  body_html_i18n?: Record<string, string> | null;
  variables?: MailVariable[] | null;
  is_active?: boolean | null;
}

export type MailVars = Record<string, unknown>;

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

function truthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (v == null || v === false || v === '') return false;
  if (typeof v === 'number') return !Number.isNaN(v);
  return true;
}

function lookup(scopes: MailVars[], name: string): unknown {
  // '{{.}}' 는 '지금 반복 중인 항목 자체' — 문자열 배열({{#lines}}{{.}}{{/lines}})에 쓴다.
  // split('.') 하면 ['',''] 이 되어 아무것도 못 찾으므로 따로 집는다.
  const path = name === '.' ? ['.'] : name.split('.');
  for (let i = scopes.length - 1; i >= 0; i--) {
    let cur: unknown = scopes[i];
    let ok = true;
    for (const seg of path) {
      if (cur && typeof cur === 'object' && seg in (cur as MailVars)) {
        cur = (cur as MailVars)[seg];
      } else {
        ok = false;
        break;
      }
    }
    if (ok) return cur;
  }
  return undefined;
}

/**
 * 템플릿 문자열을 값으로 채운다.
 *
 * 알 수 없는 변수는 '빈 문자열'로 지운다 — 실수한 변수명이 메일에 {{오타}} 로 그대로
 * 찍히는 것보다 낫다. 어드민 화면에서는 저장 전에 미지의 변수를 경고로 잡아 준다.
 */
export function renderMailBody(template: string, vars: MailVars): string {
  const scopes: MailVars[] = [vars];

  function walk(tpl: string): string {
    let out = '';
    let i = 0;
    const open = /\{\{([#^])\s*([\w.]+)\s*\}\}/g;

    while (i < tpl.length) {
      open.lastIndex = i;
      const m = open.exec(tpl);
      if (!m) {
        out += interpolate(tpl.slice(i));
        break;
      }
      out += interpolate(tpl.slice(i, m.index));

      const [, kind, name] = m;
      const close = `{{/${name}}}`;
      // 같은 이름의 중첩을 세어 짝이 맞는 닫는 태그를 찾는다.
      let depth = 1;
      let scan = open.lastIndex;
      let end = -1;
      const both = new RegExp(`\\{\\{[#^]\\s*${name}\\s*\\}\\}|\\{\\{/\\s*${name}\\s*\\}\\}`, 'g');
      both.lastIndex = scan;
      let t: RegExpExecArray | null;
      while ((t = both.exec(tpl))) {
        depth += t[0].startsWith('{{/') ? -1 : 1;
        if (depth === 0) {
          end = t.index;
          scan = t.index + t[0].length;
          break;
        }
      }
      if (end < 0) {
        // 닫는 태그가 없다 — 여는 태그를 글자 그대로 두고 넘어간다(본문을 통째로 잃지 않게).
        out += escapeHtml(m[0]);
        i = open.lastIndex;
        continue;
      }

      const inner = tpl.slice(open.lastIndex, end);
      const val = lookup(scopes, name!);

      if (kind === '^') {
        if (!truthy(val)) out += walk(inner);
      } else if (Array.isArray(val)) {
        for (const item of val) {
          scopes.push(item && typeof item === 'object' ? (item as MailVars) : { '.': item });
          out += walk(inner);
          scopes.pop();
        }
      } else if (truthy(val)) {
        if (val && typeof val === 'object') {
          scopes.push(val as MailVars);
          out += walk(inner);
          scopes.pop();
        } else {
          out += walk(inner);
        }
      }
      i = scan;
      void close;
    }
    return out;
  }

  function interpolate(chunk: string): string {
    return chunk
      .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, n: string) => String(lookup(scopes, n) ?? ''))
      .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, n: string) => escapeHtml(lookup(scopes, n) ?? ''));
  }

  return walk(template);
}

/** 템플릿 문자열에서 쓰인 변수 이름을 모두 뽑는다 — 어드민의 '미지의 변수' 경고용. */
export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  const re = /\{\{[{#^/]?\s*([\w.]+)\s*\}?\}\}/g;
  let m: RegExpExecArray | null;
  // '{{.}}'(반복 항목 자체)는 점 하나가 통째로 이름이다 — split 하면 빈 문자열이 되어
  // '이름 없는 변수'가 경고로 새어 나간다.
  while ((m = re.exec(template))) {
    const raw = m[1]!;
    found.add(raw === '.' ? '.' : raw.split('.')[0]!);
  }
  return [...found];
}

/** 구매자 메일은 언어별 본문, 운영자 메일은 단일 본문. 없으면 다른 언어로 폴백. */
export function pickTemplateText(
  tpl: MailTemplate,
  field: 'subject' | 'body_html',
  locale: string,
): string | null {
  const single = (tpl[field] ?? '') as string;
  const i18n = (tpl[`${field}_i18n` as 'subject_i18n' | 'body_html_i18n'] ?? null) as Record<
    string,
    string
  > | null;
  const pick =
    (i18n?.[locale] ?? '').trim() ||
    (i18n?.ko ?? '').trim() ||
    (i18n?.en ?? '').trim() ||
    single.trim();
  return pick || null;
}

/**
 * 템플릿을 렌더해 제목·본문을 만든다. 쓸 수 없으면 null → 호출부가 하드코딩 본문으로 돌아간다.
 * '쓸 수 없다'는 비활성이거나, 그 언어의 제목/본문이 비어 있는 경우다.
 */
export function renderMailTemplate(
  tpl: MailTemplate | null | undefined,
  vars: MailVars,
  locale = 'ko',
): { subject: string; html: string } | null {
  if (!tpl || tpl.is_active === false) return null;
  const subject = pickTemplateText(tpl, 'subject', locale);
  const body = pickTemplateText(tpl, 'body_html', locale);
  if (!subject || !body) return null;
  return {
    subject: renderMailBody(subject, vars).replace(/<[^>]+>/g, '').trim(),
    html: renderMailBody(body, vars),
  };
}

/**
 * 본문에서 쓰였지만 정의되지 않은 변수 이름 — 어드민의 '오타 경고'용.
 *
 * 반복 블록 안의 필드({{#items}} 안의 {{name}})는 최상위 변수가 아니다. 표본값이 배열이면
 * 그 항목의 키까지 '정의된 것'으로 친다. 이걸 안 하면 정상 템플릿이 전부 경고로 떠서
 * 경고 자체가 무시당한다.
 */
export function unknownVariables(
  body: string,
  defs: MailVariable[] | null | undefined,
): string[] {
  const declared = new Set<string>(['.']);
  for (const v of defs ?? []) {
    declared.add(v.name);
    for (const sample of [v.sample, ...Object.values(v.sampleI18n ?? {})]) {
    if (Array.isArray(sample)) {
      for (const item of sample) {
        if (item && typeof item === 'object') {
          for (const k of Object.keys(item as Record<string, unknown>)) declared.add(k);
        }
      }
    } else if (sample && typeof sample === 'object') {
      for (const k of Object.keys(sample as Record<string, unknown>)) declared.add(k);
    }
    }
  }
  return extractVariables(body).filter((n) => !declared.has(n));
}

/** 변수 정의의 예시값을 모아 미리보기용 값 묶음을 만든다. locale 을 주면 언어별 예시값을 쓴다. */
export function sampleVars(
  vars: MailVariable[] | null | undefined,
  locale?: string,
): MailVars {
  const out: MailVars = {};
  for (const v of vars ?? []) {
    const byLocale = locale ? v.sampleI18n?.[locale] : undefined;
    out[v.name] = byLocale ?? v.sample ?? `(${v.name})`;
  }
  return out;
}

/**
 * 템플릿 조회 — PostgREST 를 직접 부른다.
 *
 * supabase-js 클라이언트를 받지 않는 이유: 이 함수는 web(서비스롤 있음)과 partner(없음)
 * 양쪽의 서버 코드에서 불린다. 클라이언트를 인자로 넘기려면 메일 함수 11개의 시그니처를
 * 전부 바꿔야 하고, 호출부마다 '어떤 클라이언트를 줘야 하는지'를 알아야 한다.
 * 템플릿 행에는 사용자 데이터가 없고 {{변수}} 자리표시자뿐이라, 익명 키로 읽어도 새어 나갈
 * 내용이 없다(쓰기는 RLS 로 운영자만). 그래서 조회만 익명 키로 단순화한다.
 *
 * 실패는 전부 null 로 삼킨다 — 조회가 안 된다고 메일이 끊기면 안 된다.
 * (테이블 미적용 환경에서도 조용히 null 이 되어 기존 하드코딩 본문 그대로 나간다.)
 */
const TEMPLATE_COLS =
  'key,name,audience,description,subject,body_html,subject_i18n,body_html_i18n,variables,is_active';

// 한 요청에서 같은 메일을 여러 번 보낼 수 있고, 메일마다 DB 를 왕복할 이유는 없다.
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; tpl: MailTemplate | null }>();

/** 어드민에서 저장한 직후 미리보기·테스트가 옛 값을 보지 않게 하려면 캐시를 비운다. */
export function clearMailTemplateCache(): void {
  cache.clear();
}

export async function loadMailTemplate(key: string): Promise<MailTemplate | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.tpl;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  let tpl: MailTemplate | null = null;
  try {
    const res = await fetch(
      `${url}/rest/v1/mail_templates?key=eq.${encodeURIComponent(key)}&select=${TEMPLATE_COLS}&limit=1`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Accept-Profile': DB_SCHEMA }, cache: 'no-store' },
    );
    if (res.ok) {
      const rows = (await res.json()) as MailTemplate[];
      tpl = rows?.[0] ?? null;
    }
  } catch {
    tpl = null;
  }
  cache.set(key, { at: Date.now(), tpl });
  return tpl;
}

/**
 * 템플릿이 있으면 렌더하고, 없거나 쓸 수 없으면 null.
 * 호출부는 null 일 때 기존 하드코딩 본문으로 간다.
 */
export async function tryRenderTemplate(
  key: string,
  vars: MailVars,
  locale = 'ko',
): Promise<{ subject: string; html: string } | null> {
  return renderMailTemplate(await loadMailTemplate(key), vars, locale);
}
