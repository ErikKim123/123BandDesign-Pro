// 상품/행사패스 관리용 코드 자동 생성. 사람이 입력해 고민할 필요 없도록 폼에서 숨기고,
// 비어 있으면 저장 시 이 함수로 생성한다(검색·구분용 식별자).
export function genProductCode(prefix = 'P'): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}
