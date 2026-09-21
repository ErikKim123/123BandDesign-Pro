// 스위처 표시·내보내기용 순수 함수 — DOM 도 Supabase 도 건드리지 않는다.
// (그래야 노드에서 그대로 불러 검증할 수 있다 — switch.ts 는 supabase 클라이언트를 물고 있다)

/** 진행 순서 문자열의 끝 숫자를 1 올린다. '예선 3조' → '예선 4조'. 숫자가 없으면 null. */
export function nextSegment(segment: string | null | undefined): string | null {
  const s = (segment ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return null;
  const [, head, num, tail] = m;
  return `${head}${Number(num) + 1}${tail}`;
}

/** 전환 로그 → CSV. 방송이 끝난 뒤 VOD 챕터를 만들 때 이 파일을 기준으로 쓴다. */
export function switchLogCsv(
  rows: {
    switched_at: string;
    camera_slot: number | null;
    camera_label: string | null;
    segment: string | null;
    mode: string;
    result: string;
    error: string | null;
  }[],
  startedAt: string | null,
): string {
  const head = ['switched_at', 'elapsed', 'slot', 'camera', 'segment', 'mode', 'result', 'error'];
  const base = startedAt ? new Date(startedAt).getTime() : null;
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) => {
    const elapsed =
      base == null ? '' : hhmmss(Math.max(0, Math.floor((new Date(r.switched_at).getTime() - base) / 1000)));
    return [
      new Date(r.switched_at).toISOString(),
      elapsed,
      r.camera_slot ?? '',
      r.camera_label ?? '',
      r.segment ?? '',
      r.mode,
      r.result,
      r.error ?? '',
    ]
      .map(esc)
      .join(',');
  });
  return [head.join(','), ...lines].join('\n');
}

/** 초 → HH:MM:SS (방송 경과 시간·앵글 유지 시간 공용) */
export function hhmmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
