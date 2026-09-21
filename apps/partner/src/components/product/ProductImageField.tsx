// Design Ref: §5.4 상품관리 — 대표 이미지(썸네일) 업로드 (Supabase Storage 'product-images')
// 파일 선택 → Storage 업로드 → 공개 URL 을 products.image_url 로 저장
'use client';
import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { downscaleImageToBlob, blobExt, UPLOAD_CACHE_CONTROL } from '@/lib/image';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';

const BUCKET = 'band123-product-images';
const MAX_BYTES = 25 * 1024 * 1024; // 원본 25MB 까지 허용(업로드 전 압축)

// 이미지 없는 오거나이저용 샘플 커버 — 클릭 시 단색/그라데이션 이미지를 생성해 커버로 사용.
// colors 가 1개면 단색, 2~3개면 angle 방향 선형 그라데이션.
type Sample = { id: string; colors: string[]; angle?: number };
const SAMPLE_FILLS: Sample[] = [
  // 단색
  { id: 'ink', colors: ['#111827'] },
  { id: 'red', colors: ['#DC2626'] },
  { id: 'blue', colors: ['#2563EB'] },
  { id: 'green', colors: ['#059669'] },
  { id: 'violet', colors: ['#7C3AED'] },
  { id: 'amber', colors: ['#F59E0B'] },
  // 2색 그라데이션
  { id: 'sunset', colors: ['#F97316', '#DB2777'], angle: 135 },
  { id: 'ocean', colors: ['#0EA5E9', '#2563EB'], angle: 135 },
  { id: 'lime', colors: ['#84CC16', '#059669'], angle: 135 },
  { id: 'grape', colors: ['#8B5CF6', '#EC4899'], angle: 135 },
  { id: 'midnight', colors: ['#1E293B', '#4338CA'], angle: 135 },
  { id: 'peach', colors: ['#FB7185', '#FBBF24'], angle: 135 },
  // 3색 그라데이션
  { id: 'aurora', colors: ['#6366F1', '#EC4899', '#F59E0B'], angle: 135 },
  { id: 'tropic', colors: ['#06B6D4', '#10B981', '#FACC15'], angle: 135 },
  { id: 'candy', colors: ['#F472B6', '#A78BFA', '#60A5FA'], angle: 135 },
  { id: 'dusk', colors: ['#0F172A', '#7C3AED', '#EC4899'], angle: 135 },
];

// 스와치 미리보기용 CSS 배경 (단색 또는 linear-gradient)
function fillCss(s: Sample): string {
  if (s.colors.length === 1) return s.colors[0]!;
  return `linear-gradient(${s.angle ?? 135}deg, ${s.colors.join(', ')})`;
}

// canvas 에 샘플을 칠함 (단색 또는 angle 방향 그라데이션)
function paintSample(ctx: CanvasRenderingContext2D, w: number, h: number, s: Sample) {
  if (s.colors.length === 1) {
    ctx.fillStyle = s.colors[0]!;
  } else {
    const rad = ((s.angle ?? 135) * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad); // CSS: 0deg = 위쪽
    const cx = w / 2;
    const cy = h / 2;
    const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
    const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    s.colors.forEach((c, i) => g.addColorStop(i / (s.colors.length - 1), c));
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, w, h);
}

export function ProductImageField({
  value,
  set,
  allValues,
  showColorSamples = true,
}: {
  value: string | undefined;
  set: (v: string | null) => void;
  allValues: Record<string, unknown>;
  /** '기본 색상' 스와치 표시 여부 (기본 true). 행사패스 마법사에선 숨김. */
  showColorSamples?: boolean;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const id = (allValues.id as string | undefined) ?? 'new';

  async function process(file: File) {
    setErr(null);
    if (!file.type.startsWith('image/')) {
      setErr(t.imageField.errType);
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr(t.imageField.errSize);
      return;
    }
    setBusy(true);
    try {
      // 업로드 전 다운스케일·압축(JPEG) → 큰 원본도 작게
      const blob = await downscaleImageToBlob(file);
      const supabase = createClient();
      const path = `${id}/${Date.now()}.${blobExt(blob)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: UPLOAD_CACHE_CONTROL,
        upsert: true,
        contentType: blob.type || 'image/jpeg',
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      set(data.publicUrl);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t.imageField.errUpload);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // 샘플 커버(단색/그라데이션) 생성 → Storage 업로드 → 커버 URL 설정 (이미지가 없는 오거나이저용)
  async function applyFill(sample: Sample) {
    setErr(null);
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      paintSample(ctx, canvas.width, canvas.height, sample);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.9),
      );
      const supabase = createClient();
      const path = `${id}/${Date.now()}-${sample.id}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: UPLOAD_CACHE_CONTROL,
        upsert: true,
        contentType: 'image/jpeg',
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      set(data.publicUrl);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t.imageField.errUpload);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (busy) return;
            const f = e.dataTransfer.files?.[0];
            if (f) process(f);
          }}
          onClick={() => inputRef.current?.click()}
          title={t.imageField.upload}
          className={cn(
            'flex h-40 w-40 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-grey-50 transition-colors',
            drag ? 'border-2 border-dashed border-black bg-grey-100' : 'border-grey-200',
          )}
        >
          {value ? (
            // 미리보기 — 관리자 내부 도구라 next/image 대신 img 사용
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="썸네일 미리보기" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={32} className="text-grey-300" aria-hidden />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) process(f); }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? t.imageField.uploading : value ? t.imageField.change : t.imageField.upload}
            </button>
            {value && (
              <button
                type="button"
                className="btn btn-secondary btn-sm text-danger"
                disabled={busy}
                onClick={() => set(null)}
              >
                {t.imageField.remove}
              </button>
            )}
          </div>
          <p className="text-xs text-grey-500">{t.imageField.hint}</p>
          {showColorSamples && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-grey-500">{t.imageField.sampleLabel}</span>
              <div className="grid grid-cols-8 gap-1.5">
                {SAMPLE_FILLS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busy}
                    onClick={() => applyFill(s)}
                    title={s.id}
                    aria-label={`${t.imageField.sampleLabel} ${s.id}`}
                    className="aspect-square w-full rounded-md border border-grey-200 transition-transform hover:scale-110 disabled:opacity-50"
                    style={{ background: fillCss(s) }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
