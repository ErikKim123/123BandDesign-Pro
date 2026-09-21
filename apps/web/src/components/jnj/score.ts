// J&J 점수 표기 — 시상대 카드(WinnersPodium)와 전체 결과 표(JnjResults)가 같은 규칙을 쓴다.
// PostgREST 는 numeric 을 문자열로 돌려주는 경우가 있어 숫자/문자열 둘 다 받는다.
/** 점수 → '37.20'. 값이 없거나 숫자가 아니면 null(= 화면에서 줄째로 사라진다). */
export function fmtScore(v: number | string | null | undefined, digits = 2): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : null;
}
