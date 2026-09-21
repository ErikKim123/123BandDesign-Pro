// Design Ref: §5 — AI 생성 HTML 미리보기/저장 sanitize (web 과 동일 규칙, 의존성 없음).
const DANGEROUS_BLOCKS = /<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1>/gi;
const DANGEROUS_VOID = /<(script|iframe|object|embed|link|meta|base)\b[^>]*>/gi;
const EVENT_HANDLERS = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URI = /\s(href|src)\s*=\s*("|')\s*(javascript|data\s*:\s*text\/html|vbscript)[^"']*\2/gi;

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(DANGEROUS_BLOCKS, '')
    .replace(DANGEROUS_VOID, '')
    .replace(EVENT_HANDLERS, '')
    .replace(DANGEROUS_URI, ' $1="#"');
}
