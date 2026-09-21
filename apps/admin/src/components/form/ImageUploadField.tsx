// Design Ref: §5.3 — 제네릭 이미지 업로드 필드 (FieldKind 'image').
// URL 을 직접 받아 적는 대신 파일을 골라 Supabase Storage 에 올리고, 공개 URL 을 값으로 저장한다.
// ProductImageField/BadgeImageField 와 동작은 같고, 버킷·미리보기 비율·안내를 config 에서 정한다.
'use client';
import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { tr, trIn } from '@/i18n/tr';
import { useLocale, useT } from '@/lib/locale/LocaleContext';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { FieldDef } from '@/lib/resource/types';
import { downscaleImageToBlob, blobExt, UPLOAD_CACHE_CONTROL } from '@/lib/image';

const DEFAULT_BUCKET = 'band123-product-images';
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5MB

export function ImageUploadField({
  field,
  value,
  set,
  allValues,
}: {
  field: FieldDef;
  value: string | undefined;
  set: (v: string | null) => void;
  allValues: Record<string, unknown>;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tl = (v: string | undefined) => trIn(v, locale);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bucket = field.bucket ?? DEFAULT_BUCKET;
  const maxBytes = field.maxBytes ?? DEFAULT_MAX_BYTES;
  const wide = field.preview === 'wide';
  // 저장 전(신규)에는 id 가 없으므로 code, 그것도 없으면 'new' 아래에 올린다.
  const id =
    (allValues.id as string | undefined) || (allValues.code as string | undefined) || 'new';

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (!file.type.startsWith('image/')) {
      setErr(t.imageField.onlyImages);
      return;
    }
    if (file.size > maxBytes) {
      setErr(
        tr('이미지 용량이 너무 큽니다.') + ` (${Math.round(maxBytes / (1024 * 1024))}MB)`,
      );
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      // 업로드 전 다운스케일 — 원본을 그대로 올리면 목록의 작은 카드에도 원본이 실린다.
      const blob = await downscaleImageToBlob(file);
      const path = `${id}/${Date.now()}.${blobExt(blob)}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
        cacheControl: UPLOAD_CACHE_CONTROL,
        upsert: true,
        contentType: blob.type || file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      set(data.publicUrl);
    } catch (ex) {
      setErr(ex instanceof Error ? tr(ex.message) : t.imageField.uploadFailed);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="label-caps">
        {tl(field.label)}
        {field.required && ' *'}
      </label>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-grey-200 bg-grey-50',
            wide ? 'h-20 w-48' : 'h-28 w-28',
          )}
        >
          {value ? (
            // 미리보기 — 관리자 내부 도구라 next/image 대신 img 사용
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={t.imageField.previewAlt} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={28} className="text-grey-300" aria-hidden />
          )}
        </div>
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
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
          <p className="text-xs text-grey-500">{tl(field.hint) || t.imageField.hint}</p>
        </div>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
