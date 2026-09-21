// 무설치 리치 에디터(WYSIWYG) — contentEditable + 툴바. 값은 HTML 문자열(I18n)로 저장.
// 보이는 그대로가 고객 페이지에 렌더됨. 기존 sanitize/prose 스타일과 그대로 호환.
// 의존성 추가 없음(NAS 설치 이슈 회피). document.execCommand 기반(레거시지만 전 브라우저 지원).
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold, Italic, Heading2, Heading3, Pilcrow, List, ListOrdered,
  Link2, Image as ImageIcon, Eraser, Loader2,
} from 'lucide-react';
import { isMirrorI18n, mirrorI18n, type I18n, type Locale } from '@123band/shared';
import { createClient } from '@/lib/supabase/client';
import { downscaleImageToBlob, blobExt, UPLOAD_CACHE_CONTROL } from '@/lib/image';
import { useGlobalLocale } from '@/lib/i18n/locale-context';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';

const BUCKET = 'band123-product-images';
const MAX_BYTES = 25 * 1024 * 1024; // 원본 25MB 까지 허용(업로드 전 압축)

// ── 단일 로케일 리치 에디터 ───────────────────────────────────
export function RichEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const lastEmitted = useRef<string>(value);
  const [busy, setBusy] = useState(false);

  // 최초 1회 주입
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || '';
      lastEmitted.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 외부 값 변경(로케일 전환/AI 생성) 시에만 DOM 동기화 → 입력 중 커서 점프 방지
  useEffect(() => {
    if (!ref.current) return;
    if (value !== lastEmitted.current) {
      ref.current.innerHTML = value || '';
      lastEmitted.current = value;
    }
  }, [value]);

  const isEmpty = useMemo(() => {
    const v = value || '';
    if (/<img/i.test(v)) return false;
    return v.replace(/<[^>]*>/g, '').replace(/ /g, ' ').trim().length === 0;
  }, [value]);

  function emit() {
    const html = ref.current?.innerHTML ?? '';
    lastEmitted.current = html;
    onChange(html);
  }
  function saveSel() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSel() {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }
  // 툴바 버튼: onMouseDown preventDefault 로 에디터 선택영역 유지
  function run(cmd: string, val?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  }
  function addLink() {
    const url = window.prompt('링크 URL 을 입력하세요', 'https://');
    if (!url) return;
    run('createLink', url);
  }
  function insertImageUrl() {
    const url = window.prompt(t.editor.imgUrlPrompt, 'https://');
    if (!url) return;
    run('insertImage', url);
  }
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_BYTES) {
      window.alert(t.editor.imgOnly);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBusy(true);
    try {
      // 업로드 전 다운스케일·압축(JPEG) → 5MB 넘는 큰 이미지도 업로드 가능
      const blob = await downscaleImageToBlob(file);
      const supabase = createClient();
      const path = `event-content/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${blobExt(blob)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: UPLOAD_CACHE_CONTROL, upsert: true, contentType: blob.type || 'image/jpeg',
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      ref.current?.focus();
      restoreSel();
      document.execCommand('insertImage', false, data.publicUrl);
      emit();
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : t.editor.uploadFail);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="rounded-lg border border-grey-200">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-grey-100 bg-grey-50 px-1.5 py-1">
        <Tb onClick={() => run('bold')} title={t.editor.bold}><Bold size={15} /></Tb>
        <Tb onClick={() => run('italic')} title={t.editor.italic}><Italic size={15} /></Tb>
        <Sep />
        <Tb onClick={() => run('formatBlock', '<h2>')} title={t.editor.h2}><Heading2 size={15} /></Tb>
        <Tb onClick={() => run('formatBlock', '<h3>')} title={t.editor.h3}><Heading3 size={15} /></Tb>
        <Tb onClick={() => run('formatBlock', '<p>')} title={t.editor.p}><Pilcrow size={15} /></Tb>
        <Sep />
        <Tb onClick={() => run('insertUnorderedList')} title={t.editor.ul}><List size={15} /></Tb>
        <Tb onClick={() => run('insertOrderedList')} title={t.editor.ol}><ListOrdered size={15} /></Tb>
        <Sep />
        <Tb onClick={addLink} title={t.editor.link}><Link2 size={15} /></Tb>
        <Tb onMouseDownExtra={saveSel} onClick={() => fileRef.current?.click()} title={t.editor.imageUpload}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
        </Tb>
        <Tb onClick={insertImageUrl} title={t.editor.imageUrl}>URL</Tb>
        <Sep />
        <Tb onClick={() => run('removeFormat')} title={t.editor.clearFormat}><Eraser size={15} /></Tb>
      </div>

      {/* 편집 영역 */}
      <div className="relative">
        {isEmpty && (
          <p className="pointer-events-none absolute left-3 top-3 text-sm text-grey-400">
            {placeholder ?? t.editor.placeholder}
          </p>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={() => { saveSel(); emit(); }}
          onKeyUp={saveSel}
          onMouseUp={saveSel}
          className="min-h-32 max-h-[28rem] overflow-y-auto p-3 text-sm leading-relaxed text-grey-800 focus:outline-none [&_a]:text-info [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-grey-300 [&_blockquote]:pl-3 [&_blockquote]:text-grey-600 [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
    </div>
  );
}

function Tb({
  children, onClick, title, onMouseDownExtra,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  onMouseDownExtra?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      // 에디터 선택영역 유지: 클릭 시 포커스 이동 방지
      onMouseDown={(e) => { e.preventDefault(); onMouseDownExtra?.(); }}
      onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-semibold text-grey-600 transition-colors hover:bg-grey-200 hover:text-black"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 h-5 w-px bg-grey-200" />;
}

// ── 다국어(I18n) 탭 래퍼 ──────────────────────────────────────
// 상품/행사패스 상세는 영문·한글 버전만.
const ALL_TABS: { locale: Locale; label: string }[] = [
  { locale: 'en', label: 'EN' },
  { locale: 'ko', label: 'KO' },
];

export function RichEditorI18n({
  label,
  value,
  onChange,
  locales = ['en', 'ko'],
}: {
  label: string;
  value: I18n;
  onChange: (next: I18n) => void;
  locales?: Locale[];
}) {
  const tabs = ALL_TABS.filter((tab) => locales.includes(tab.locale));
  const t = useT();
  // 전역 토글이 있고 그 로케일이 이 에디터가 지원하는 언어면 그걸 따른다(자체 탭 숨김).
  const g = useGlobalLocale();
  const [localActive, setLocalActive] = useState<Locale>(locales[0] ?? 'en');
  const controlled = g.controlled && !!g.locale && locales.includes(g.locale);
  const active = controlled ? (g.locale as Locale) : localActive;
  const lastEdited = useRef<Locale | null>(null);
  // 한쪽 언어만 채우면 반대 언어가 비는 문제 → 아직 손대지 않은 언어에 같은 본문을 미러링한다.
  // 미러본은 원문과 동일하므로 8단계 AI 번역이 다시 덮어쓸 수 있다.
  const other = locales.find((l) => l !== active) ?? 'en';
  const mirrored = isMirrorI18n(value, active, other);
  const hint =
    active !== 'en' && !value.en?.trim()
      ? t.editor.enFallback
      : mirrored
        ? t.editor.mirrorNote(other.toUpperCase())
        : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="label-caps">{label}</label>
        {!controlled && (
          <div className="flex gap-1">
            {tabs.map(({ locale, label }) => (
              <button key={locale} type="button" onClick={() => setLocalActive(locale)}
                className={cn('rounded-pill px-2.5 py-0.5 text-[11px] font-medium uppercase transition-colors',
                  active === locale ? 'bg-black text-white' : 'bg-grey-100 text-grey-500')}>
                {label}{value[locale]?.trim() ? ' ●' : ''}
              </button>
            ))}
          </div>
        )}
      </div>
      <RichEditor
        key={active}
        value={value[active] ?? ''}
        onChange={(html) => {
          // I18nField 와 같은 규칙 — 언어 탭을 옮긴 직후 첫 입력은 반대 언어를 따라가게 두지 않는다.
          const continuing = lastEdited.current === active;
          lastEdited.current = active;
          onChange(mirrorI18n(value, active, html, locales, continuing));
        }}
      />
      {hint && <p className="text-[11px] text-grey-400">{hint}</p>}
    </div>
  );
}
