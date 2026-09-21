// 구글 시트 → instagram_posts 일괄 등록.
// preview: 시트를 읽어 등록 대상만 돌려준다(저장 없음).
// commit:  external_ref(sheet:PostID)로 업서트한다. 이미 '게시 완료'된 행은 건드리지 않는다.
// ⚠️ 서버 전용.
import { igAdminClient } from './token';
import { fetchSheetCsv, parseSheet, type SheetRow } from './sheet';

export interface ImportPreview {
  rows: SheetRow[]; // IG 대상 전체
  importable: number; // 실제 등록 가능 건수
  invalid: number; // 링크/일시 문제로 제외되는 건수
  totalRows: number; // 시트 전체 데이터 행 수
}

export async function previewSheet(url: string): Promise<ImportPreview> {
  const csv = await fetchSheetCsv(url);
  const { rows, totalRows } = parseSheet(csv);
  const invalid = rows.filter((r) => r.error).length;
  return { rows, importable: rows.length - invalid, invalid, totalRows };
}

export interface ImportResult {
  created: number;
  updated: number;
  skippedPosted: number; // 이미 게시 완료라 건드리지 않음
  invalid: number; // 링크/일시 문제로 제외
}

export async function commitSheet(url: string, adminId?: string | null): Promise<ImportResult> {
  const { rows } = parseSheet(await fetchSheetCsv(url));
  const importable = rows.filter((r): r is SheetRow & { scheduledAt: string } => !r.error && !!r.scheduledAt);
  const invalid = rows.length - importable.length;
  if (importable.length === 0) return { created: 0, updated: 0, skippedPosted: 0, invalid };

  const supabase = igAdminClient();
  const refs = importable.map((r) => r.externalRef);

  // 기존 행 조회 — 이미 있는 건 갱신, 게시 완료된 건 보존.
  const { data: existing, error: exErr } = await supabase
    .from('instagram_posts')
    .select('id, external_ref, status')
    .in('external_ref', refs);
  if (exErr) throw new Error(exErr.message);

  const byRef = new Map((existing ?? []).map((e) => [e.external_ref as string, e as { id: string; status: string }]));

  const toInsert: Record<string, unknown>[] = [];
  const updates: PromiseLike<{ error: { message: string } | null }>[] = [];
  let skippedPosted = 0;

  for (const r of importable) {
    const hit = byRef.get(r.externalRef);
    const fields = {
      scheduled_at: r.scheduledAt,
      caption: r.caption,
      media_type: 'REELS' as const, // 시트 콘텐츠는 동영상(릴스)
      media_url: r.mediaUrl,
    };

    if (!hit) {
      toInsert.push({ ...fields, external_ref: r.externalRef, created_by: adminId ?? null });
    } else if (hit.status === 'posted') {
      skippedPosted++;
    } else {
      // 재업로드 시 실패/취소 상태도 다시 예약 대기로 되돌린다.
      updates.push(
        supabase
          .from('instagram_posts')
          .update({ ...fields, status: 'scheduled', error: null, attempts: 0, updated_at: new Date().toISOString() })
          .eq('id', hit.id),
      );
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('instagram_posts').insert(toInsert);
    if (error) throw new Error(error.message);
  }
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  return { created: toInsert.length, updated: updates.length, skippedPosted, invalid };
}
