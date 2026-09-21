// 구글 시트(인스타 콘텐츠 로그) → 예약 게시 초안.
// 시트를 CSV 로 내려받아, 헤더 이름으로 열을 찾아(열 위치가 바뀌어도 견딤) IG 행만 뽑는다.
// 시각은 한국시간(KST)으로 적혀 있다고 보고 UTC 로 변환해 저장한다.
// ⚠️ 서버 전용.

export interface SheetRow {
  externalRef: string; // 'sheet:P-001' — 재업로드 시 중복 방지 키
  postId: string;
  scheduledAt: string | null; // ISO(UTC). 파싱 실패 시 null
  whenLabel: string; // 미리보기용 표시(KST 원문)
  caption: string;
  mediaUrl: string; // 드라이브 링크(발행 시 공개 URL 로 변환)
  account: string;
  topic: string;
  platforms: string;
  error: string | null; // 등록 불가 사유(있으면 미리보기에서 제외 표시)
}

// ── 시트 링크 파싱 ──
export function parseSheetRef(url: string): { id: string; gid: string } | null {
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) return null;
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0';
  return { id, gid };
}

function csvExportUrl(id: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** 시트 CSV 를 내려받는다. 비공개(401/403)면 공유 안내 오류를 던진다. */
export async function fetchSheetCsv(url: string): Promise<string> {
  const ref = parseSheetRef(url);
  if (!ref) throw new Error('구글 시트 링크 형식이 올바르지 않습니다.');
  const res = await fetch(csvExportUrl(ref.id, ref.gid), { redirect: 'follow' });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      '시트를 읽을 권한이 없습니다. 구글 시트 › 공유 › "링크가 있는 모든 사용자"를 "뷰어"로 설정한 뒤 다시 시도하세요.',
    );
  }
  if (!res.ok) throw new Error(`시트를 불러오지 못했습니다(HTTP ${res.status}).`);
  const text = await res.text();
  if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
    throw new Error('시트 대신 로그인 페이지가 반환됐습니다. 공유 설정을 "링크가 있는 모든 사용자·뷰어"로 바꿔 주세요.');
  }
  return text;
}

// ── CSV 파서(RFC4180: 따옴표·쉼표·줄바꿈 포함 셀 지원) ──
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ── 헤더 이름으로 열 찾기 ──
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

function findCol(headers: string[], candidates: string[]): number {
  const H = headers.map(norm);
  for (const cand of candidates) {
    const c = norm(cand);
    const i = H.findIndex((h) => h === c);
    if (i >= 0) return i;
  }
  for (const cand of candidates) {
    const c = norm(cand);
    const i = H.findIndex((h) => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

// ── 한국시간 파싱 ── date 셀 + time 셀 → UTC ISO ──
function parseDateCell(v: string): { y: number; mo: number; d: number } | null {
  const m = v.trim().match(/(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (!m) return null;
  return { y: +m[1]!, mo: +m[2]!, d: +m[3]! };
}

function parseTimeCell(v: string): { h: number; min: number } | null {
  const t = v.trim();
  const m = t.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return null;
  let h = +m[1]!;
  const min = +m[2]!;
  const pm = /오후|pm/i.test(t);
  const am = /오전|am/i.test(t);
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return { h, min };
}

/** date/time 셀(KST 가정) → UTC ISO. 실패 시 null. */
function toUtcIso(dateCell: string, timeCell: string): string | null {
  const d = parseDateCell(dateCell);
  if (!d) return null;
  const t = parseTimeCell(timeCell) ?? { h: 19, min: 0 }; // 시간 누락 시 저녁 7시(KST) 기본
  // KST(UTC+9) → UTC. Date.UTC 가 음수 시각/날짜 넘김을 알아서 처리한다.
  const ms = Date.UTC(d.y, d.mo - 1, d.d, t.h - 9, t.min, 0);
  const dt = new Date(ms);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

/** platforms 셀에 인스타(IG)가 포함되는지. */
function includesInstagram(platforms: string): boolean {
  return /\big\b|instagram|인스타/i.test(platforms);
}

export interface ParsedSheet {
  rows: SheetRow[]; // IG 대상 전체(등록 가능/불가 포함)
  totalRows: number; // 데이터 행 수(헤더 제외)
  columns: Record<string, number>; // 감지된 열 인덱스(디버그/안내용)
}

export function parseSheet(csv: string): ParsedSheet {
  const table = parseCsv(csv).filter((r) => r.some((c) => c.trim() !== ''));
  if (table.length < 2) return { rows: [], totalRows: 0, columns: {} };

  const headers = table[0]!;
  const col = {
    postId: findCol(headers, ['Post ID', 'PostID', 'ID']),
    date: findCol(headers, ['Date']),
    time: findCol(headers, ['Time']),
    account: findCol(headers, ['Account']),
    topic: findCol(headers, ['Content Topic', 'Topic']),
    platforms: findCol(headers, ['Platforms', 'Platform']),
    media: findCol(headers, ['Google Drive Video Link', 'Drive Video', 'Video Link', 'Drive', 'Video']),
    caption: findCol(headers, ['Caption', 'Captions']),
    notes: findCol(headers, ['Strategy Notes', 'Notes']),
  };

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

  // Platforms 열이 없는 탭은 이미 IG 전용(예: 'IG Caption' 열만 있는 시트)이므로 전 행을 대상으로 본다.
  const hasPlatformCol = col.platforms >= 0;

  const rows: SheetRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i]!;
    const platforms = get(r, col.platforms);
    if (hasPlatformCol && !includesInstagram(platforms)) continue;

    const postId = get(r, col.postId) || `row-${i + 1}`;
    const dateCell = get(r, col.date);
    const timeCell = get(r, col.time);
    const media = get(r, col.media);
    const topic = get(r, col.topic);
    const account = get(r, col.account);

    // 캡션: 전용 열이 있으면 그걸, 없으면 콘텐츠 주제를 초안으로.
    const caption = get(r, col.caption) || topic;

    const scheduledAt = toUtcIso(dateCell, timeCell);

    let error: string | null = null;
    if (!scheduledAt) error = '게시 일시를 읽지 못했습니다(Date/Time 확인).';
    else if (!media) error = '동영상 링크가 비어 있습니다.';
    else if (!/^https?:\/\//i.test(media)) error = '동영상 링크가 URL 형식이 아닙니다.';

    rows.push({
      externalRef: `sheet:${postId}`,
      postId,
      scheduledAt,
      whenLabel: [dateCell, timeCell].filter(Boolean).join(' '),
      caption,
      mediaUrl: media,
      account,
      topic,
      platforms,
      error,
    });
  }

  return { rows, totalRows: table.length - 1, columns: col };
}
