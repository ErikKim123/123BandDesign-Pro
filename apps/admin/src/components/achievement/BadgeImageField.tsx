// Design Ref: 업적관리 — 뱃지 이미지 등록 (Supabase Storage 'badges').
// 파일 선택 → Storage 업로드 → 공개 URL 을 achievements.badge_image_url 로 저장.
// ProductImageField 와 동작은 같고, 버킷과 미리보기 모양(원형 뱃지)만 다르다.
'use client';
import { useRef, useState } from 'react';
import { tr } from '@/i18n/tr';
import { Award, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/locale/LocaleContext';
import { downscaleImageToBlob, blobExt, UPLOAD_CACHE_CONTROL } from '@/lib/image';

const BUCKET = 'band123-badges';
const MAX_BYTES = 2 * 1024 * 1024; // 2MB — 뱃지는 작은 아이콘이라 충분

export function BadgeImageField({
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
  const [zoom, setZoom] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 저장 전(신규)에는 id 가 없으므로 code 로, 그것도 없으면 'new' 아래에 올린다.
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
    if (file.size > MAX_BYTES) {
      setErr(tr('이미지는 2MB 이하만 등록할 수 있습니다.'));
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      // 뱃지는 배경이 투명한 PNG 가 많다 — 유틸이 투명도를 감지해 PNG 로 유지한다.
      const blob = await downscaleImageToBlob(file, 512);
      const path = `${id}/${Date.now()}.${blobExt(blob, 'png')}`;
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

  /** 등록된 뱃지를 파일로 — 이름은 업적 코드. 스토리지는 다른 도메인이라 <a download> 만으로는
      새 탭에서 열리기만 해서, 먼저 받아 blob 으로 만든 뒤 내려받는다. */
  async function download() {
    if (!value) return;
    const code = (allValues.code as string | undefined) || 'badge';
    try {
      const res = await fetch(value);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${code}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      window.open(value, '_blank', 'noopener');
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {/* 미리보기는 96px 원형이라 디테일이 안 보인다 — 누르면 원본으로 띄운다.
            뱃지는 고객 화면에서 크게 보이는 그림이라 등록 전에 확인이 필요하다. */}
        <button
          type="button"
          onClick={() => value && setZoom(true)}
          disabled={!value}
          aria-label={t.imageField.previewAlt}
          className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-grey-200 bg-grey-50 transition-transform enabled:cursor-zoom-in enabled:hover:scale-105"
        >
          {value ? (
            // 미리보기 — 관리자 내부 도구라 next/image 대신 img 사용
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={t.imageField.previewAlt} className="h-full w-full object-cover" />
          ) : (
            <Award size={28} className="text-grey-300" aria-hidden />
          )}
        </button>

        {zoom && value && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              aria-label={tr('닫기')}
              onClick={() => setZoom(false)}
              className="absolute inset-0 cursor-zoom-out bg-black/70"
            />
            {/* 원본 그대로 — 잘리지 않게 contain. 투명 배경 PNG 가 보이도록 흰 판 위에 놓는다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={t.imageField.previewAlt}
              className="relative z-10 max-h-[80vh] w-auto max-w-[min(90vw,28rem)] rounded-2xl bg-white object-contain p-4 shadow-4"
            />
          </div>
        )}
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
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => void download()}
              >
                <Download size={14} /> {tr('내려받기')}
              </button>
            )}
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
          <p className="text-xs text-grey-500">
            {tr('정사각형 PNG(투명 배경) 권장 · 2MB 이하. 등록 전에는 기본 아이콘으로 표시됩니다.')}
          </p>
        </div>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}
