// 관리자 입력(FORMAT·Guidelines 등)을 렌더 가능한 HTML 로 만든다.
// 어드민 입력칸이 평범한 textarea 라 원문이 HTML 일 수도, 그냥 줄바꿈 텍스트일 수도 있다.
//   · HTML 이면 → sanitize 만
//   · 평문이면 → 마크다운 비슷한 최소 문법(제목/목록/문단)만 HTML 로 승격 후 sanitize
// 목적은 완전한 마크다운 지원이 아니라 "붙여넣은 원문이 그대로 뭉개지지 않게" 하는 것.
import { sanitizeHtml } from '@/lib/sanitize';

const HTML_TAG = /<(p|div|ul|ol|li|h[1-6]|br|table|section|span|strong|em|a|img)\b/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 인라인 강조만 최소 지원: **굵게** */
function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** 평문 → HTML. 빈 줄로 블록을 나누고, 블록 단위로 제목/목록/문단을 판정한다. */
function plainToHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const out: string[] = [];

  for (const raw of blocks) {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // '## 대제목' / '### 소제목' — 2단계까지 위계를 살린다(#·## → h3, ### 이하 → h4).
    const only = lines.length === 1 ? lines[0] : undefined;
    const heading = only?.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const tag = heading[1]!.length >= 3 ? 'h4' : 'h3';
      out.push(`<${tag}>${inline(heading[2] ?? '')}</${tag}>`);
      continue;
    }
    // '- ' / '• ' 불릿 목록
    if (lines.every((l) => /^[-•*]\s+/.test(l))) {
      const items = lines.map((l) => `<li>${inline(l.replace(/^[-•*]\s+/, ''))}</li>`).join('');
      out.push(`<ul>${items}</ul>`);
      continue;
    }
    // '1. ' 번호 목록
    if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      const items = lines.map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('');
      out.push(`<ol>${items}</ol>`);
      continue;
    }
    // 그 외 — 한 문단(줄바꿈은 <br> 로 보존)
    out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
  }

  return out.join('');
}

/** 관리자 입력 원문 → 안전한 렌더용 HTML. 비어 있으면 ''. */
export function toRichHtml(input: string | null | undefined): string {
  const text = (input ?? '').trim();
  if (!text) return '';
  return sanitizeHtml(HTML_TAG.test(text) ? text : plainToHtml(text));
}
