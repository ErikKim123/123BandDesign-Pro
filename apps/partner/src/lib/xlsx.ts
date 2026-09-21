// 의존성 없이 .xlsx(OOXML SpreadsheetML) 파일을 조립한다 — 서버 전용(node:zlib).
// NAS(UNC) 환경에서 pnpm add 가 락파일에 절대경로를 박아 배포를 깨뜨린 전례가 있어
// exceljs/sheetjs 설치 대신 최소 스펙 워크북을 직접 만든다. (문자열은 inlineStr, 압축은 deflate-raw)
import { deflateRawSync } from 'node:zlib';

/** 셀 값 — 숫자는 숫자 셀, 그 외는 문자열. null/undefined/'' 는 빈 셀(태그 자체를 생략). */
export type XlsxCell = string | number | null | undefined;

export interface XlsxColumn {
  header: string;
  /** 열 너비(문자 폭). 기본 18 */
  width?: number;
  /** 긴 텍스트 열 — 줄바꿈 표시 + 위 정렬 */
  wrap?: boolean;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxCell[][];
}

/** Excel 셀 하나가 담을 수 있는 최대 문자 수 */
const MAX_CELL = 32767;

// ── XML 유틸 ─────────────────────────────────────────────────
function esc(s: string): string {
  // XML 1.0 이 허용하지 않는 제어문자는 제거(탭/개행/캐리지리턴만 남긴다) — 없으면 Excel 이 파일을 거부한다.
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 0 → A, 25 → Z, 26 → AA */
function colName(index: number): string {
  let s = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

/** 시트명 제약 — 31자, `\ / ? * [ ] :` 금지 */
function safeSheetName(raw: string, index: number): string {
  const s = raw.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return s || `Sheet${index + 1}`;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// 스타일 인덱스 — styles.xml 의 cellXfs 순서와 1:1
const S_DEFAULT = 0;
const S_HEADER = 1;
const S_WRAP = 2;

function cellXml(ref: string, value: XlsxCell, style: number): string {
  if (value == null || value === '') return '';
  const s = style ? ` s="${style}"` : '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(
    String(value).slice(0, MAX_CELL),
  )}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.columns;
  const lastCol = colName(Math.max(cols.length - 1, 0));
  const lastRow = Math.max(sheet.rows.length + 1, 1);
  const out: string[] = [XML_HEAD, `<worksheet xmlns="${NS_MAIN}">`];
  out.push(`<dimension ref="A1:${lastCol}${lastRow}"/>`);
  // 헤더 행 고정 — 스크롤해도 어떤 항목인지 보인다.
  out.push(
    '<sheetViews><sheetView workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '</sheetView></sheetViews>',
  );
  out.push('<sheetFormatPr defaultRowHeight="15"/>');
  if (cols.length) {
    out.push(
      '<cols>' +
        cols
          .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 18}" customWidth="1"/>`)
          .join('') +
        '</cols>',
    );
  }
  out.push('<sheetData>');
  out.push(
    '<row r="1" ht="24" customHeight="1">' +
      cols.map((c, i) => cellXml(`${colName(i)}1`, c.header, S_HEADER)).join('') +
      '</row>',
  );
  sheet.rows.forEach((row, r) => {
    const n = r + 2;
    const cells = row
      .map((v, i) => cellXml(`${colName(i)}${n}`, v, cols[i]?.wrap ? S_WRAP : S_DEFAULT))
      .join('');
    out.push(`<row r="${n}">${cells}</row>`);
  });
  out.push('</sheetData>');
  if (cols.length) out.push(`<autoFilter ref="A1:${lastCol}1"/>`); // 필터 = 마스터 파일에서 골라보기
  out.push('</worksheet>');
  return out.join('');
}

function stylesXml(): string {
  return (
    XML_HEAD +
    `<styleSheet xmlns="${NS_MAIN}">` +
    '<fonts count="2">' +
    '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1A1A1A"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">' +
    '<alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">' +
    '<alignment vertical="top" wrapText="1"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

// ── ZIP (deflate-raw, 저장 엔트리 없음) ───────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function zip(entries: { name: string; data: Buffer }[]): Buffer {
  const files: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // 타임스탬프는 1980-01-01 고정 — 같은 데이터면 항상 같은 바이트가 나온다.
  const DOS_TIME = 0;
  const DOS_DATE = 33; // (1980-1980)<<9 | 1<<5 | 1

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const comp = deflateRawSync(e.data, { level: 9 });
    const crc = crc32(e.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 파일명
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    files.push(local, name, comp);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    offset += local.length + name.length + comp.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...files, cdBuf, eocd]);
}

/** 시트 목록 → .xlsx 바이트. 시트명 중복/금지문자는 자동 보정된다. */
export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  const used = new Set<string>();
  const named = sheets.map((s, i) => {
    let name = safeSheetName(s.name, i);
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${safeSheetName(s.name, i).slice(0, 28)}(${n++})`;
    used.add(name.toLowerCase());
    return { ...s, name };
  });

  const stylesRid = `rId${named.length + 1}`;

  const contentTypes =
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    named
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '</Types>';

  const rootRels =
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>';

  const workbook =
    XML_HEAD +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
    named
      .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets></workbook>';

  const workbookRels =
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    named
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="${stylesRid}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
    '</Relationships>';

  const buf = (s: string) => Buffer.from(s, 'utf8');
  return zip([
    { name: '[Content_Types].xml', data: buf(contentTypes) },
    { name: '_rels/.rels', data: buf(rootRels) },
    { name: 'xl/workbook.xml', data: buf(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: buf(workbookRels) },
    { name: 'xl/styles.xml', data: buf(stylesXml()) },
    ...named.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: buf(sheetXml(s)) })),
  ]);
}
