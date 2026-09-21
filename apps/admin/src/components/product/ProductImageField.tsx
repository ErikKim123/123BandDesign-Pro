// Design Ref: §5.4 상품관리 — 대표 이미지(썸네일) 업로드 (Supabase Storage 'product-images')
// 파일 선택 → Storage 업로드 → 공개 URL 을 products.image_url 로 저장
'use client';
import { useRef, useState } from 'react';
import { tr } from '@/i18n/tr';
import { ImagePlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/locale/LocaleContext';
import { downscaleImageToBlob, blobExt, UPLOAD_CACHE_CONTROL } from '@/lib/image';

const BUCKET = 'band123-product-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export function ProductImageField({
  value,
  set,
  allValues,
}: {
  value: string | undefined;
  set: (v: string | null) => void;
  allValues: Record<string, unknown>;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const id = (allValues.id as string | undefined) ?? 'new';

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith('image/')) {
      setErr(t.imageField.onlyImages);
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr(t.imageField.maxSize);
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const blob = await downscaleImageToBlob(file);
      const path = `${id}/${Date.now()}.${blobExt(blob)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: UPLOAD_CACHE_CONTROL,
        upsert: true,
        contentType: blob.type || file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      set(data.publicUrl);
    } catch (ex) {
      setErr(ex instanceof Error ? tr(ex.message) : t.imageField.uploadFailed);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-grey-200 bg-grey-50">
          {value ? (
            // 미리보기 — 관리자 내부 도구라 next/image 대신 img 사용
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={t.imageField.previewAlt} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={28} className="text-grey-300" aria-hidden />
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
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
        </div>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
