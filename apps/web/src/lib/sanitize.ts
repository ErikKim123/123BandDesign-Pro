// Design Ref: §5 AI 상품페이지 — 상세 HTML sanitize (저장·렌더 양쪽). 의존성 없는 경량 구현.
// 추후 isomorphic-dompurify 로 교체 가능하도록 단일 함수로 추상화.

// 통째로 제거할 위험 요소 (태그 + 내용)
const DANGEROUS_BLOCKS = /<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1>/gi;
// 자기닫힘/짝 없는 위험 태그
const DANGEROUS_VOID = /<(script|iframe|object|embed|link|meta|base)\b[^>]*>/gi;
// on* 이벤트 핸들러 속성 (onclick=, onerror= 등)
const EVENT_HANDLERS = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
// javascript:/data:(text/html) 등 위험 스킴 (href/src 내부)
const DANGEROUS_URI = /\s(href|src)\s*=\s*("|')\s*(javascript|data\s*:\s*text\/html|vbscript)[^"']*\2/gi;

/**
 * 신뢰 경계가 약한 HTML(detail_html_i18n)에서 실행 가능한 요소를 제거한다.
 * AI 생성 + 관리자 검수본 전제이나, XSS 방어를 위해 렌더 직전 항상 통과시킨다.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(DANGEROUS_BLOCKS, '')
    .replace(DANGEROUS_VOID, '')
    .replace(EVENT_HANDLERS, '')
    .replace(DANGEROUS_URI, ' $1="#"');
}
