// Design Ref: §5 Phase 3 — 상품 상세 HTML 에디터 (직접 작성 우선) + AI 초안 생성(보조) + 번역
'use client';
import { useState } from 'react';
import { Sparkles, Languages, Loader2, ChevronDown, ChevronUp, Code, Eye, X } from 'lucide-react';
import { pickI18n, type I18n, type Locale } from '@123band/shared';
import { sanitizeHtml } from '@/lib/sanitize';
import { useT } from '@/i18n/useT';
import { RichEditor } from '@/components/editor/RichEditor';

// 상품/행사패스 상세는 영문·한글 버전만.
const LOCALES: Locale[] = ['en', 'ko'];
const LABEL: Record<string, string> = { en: 'EN', ko: 'KO' };

export function AiProductGenerator({
  value,
  set,
  allValues,
}: {
  value: I18n | undefined;
  set: (v: I18n) => void;
  allValues: Record<string, unknown>;
}) {
  const t = useT();
  const html: I18n = value ?? {};
  const [tab, setTab] = useState<Locale>('en');
  const [showAi, setShowAi] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [features, setFeatures] = useState('');
  const [imageUrls, setImageUrls] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameI18n = allValues.name_i18n as I18n | undefined;
  const productName = pickI18n(nameI18n, 'en') || pickI18n(nameI18n, 'ko');

  function setLang(locale: Locale, h: string) {
    set({ ...html, [locale]: h });
  }

  async function generate() {
    setError(null);
    if (!productName) {
      setError(t.ai.errNoName);
      return;
    }
    setLoading('generate');
    try {
      const res = await fetch('/api/ai/generate-product', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: productName,
          keywords,
          features: features.split('\n').map((s) => s.trim()).filter(Boolean),
          imageUrls: imageUrls.split('\n').map((s) => s.trim()).filter(Boolean),
          productId: (allValues.id as string) ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.ai.errGen);
      setLang('en', data.html);
      setTab('en');
      setShowAi(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.ai.errGen);
    } finally {
      setLoading(null);
    }
  }

  async function translate(target: Locale) {
    setError(null);
    if (!html.en) {
      setError(t.ai.errNoEn);
      return;
    }
    setLoading(target);
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html: html.en, targetLocale: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.ai.errTranslate);
      setLang(target, data.html);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.ai.errTranslate);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-grey-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code size={16} />
          <span className="label-caps">{t.ai.header}</span>
        </div>
        {/* AI 초안 생성: 접이식 보조 도구 */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowAi((v) => !v)}
        >
          <Sparkles size={14} /> {t.ai.aiDraft} {showAi ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* AI 생성 패널 (접이식) */}
      {showAi && (
        <div className="space-y-2 rounded-lg bg-grey-50 p-3">
          <p className="text-xs text-grey-500">{t.ai.aiNote}</p>
          <input
            className="input"
            placeholder={t.ai.keywordsPh}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <textarea
            className="input min-h-16"
            placeholder={t.ai.featuresPh}
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
          />
          <textarea
            className="input min-h-12"
            placeholder={t.ai.imageUrlsPh}
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={generate}
            disabled={loading !== null}
          >
            {loading === 'generate' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {t.ai.genEn}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 언어 탭 */}
      <div className="flex items-center justify-between border-b border-grey-200">
        <div className="flex gap-1">
          {LOCALES.map((l) => (
            <button
              type="button"
              key={l}
              onClick={() => setTab(l)}
              className={`px-3 py-1.5 text-sm ${
                tab === l ? 'border-b-2 border-black font-medium' : 'text-grey-500'
              }`}
            >
              {LABEL[l]} {html[l] ? '●' : ''}
            </button>
          ))}
        </div>
        {tab !== 'en' && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-grey-500 hover:text-black"
            onClick={() => translate(tab)}
            disabled={loading !== null}
          >
            {loading === tab ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Languages size={14} />
            )}
            {t.ai.translateTo(LABEL[tab] ?? tab)}
          </button>
        )}
      </div>

      {/* 리치 에디터 (직접 작성) — 로케일 전환 시 재주입 위해 key={tab} */}
      <RichEditor
        key={tab}
        value={html[tab] ?? ''}
        onChange={(h) => setLang(tab, h)}
        placeholder={t.ai.editorPlaceholder}
      />

      {/* 라이브 미리보기 (항상) */}
      <div className="rounded-lg border border-grey-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="label-caps text-grey-400">{t.ai.preview(LABEL[tab] ?? tab)}</p>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={!html[tab]}
            className="flex items-center gap-1 text-xs text-grey-500 hover:text-black disabled:opacity-40"
          >
            <Eye size={14} /> {t.ai.fullPreview}
          </button>
        </div>
        {html[tab] ? (
          <div
            className="text-sm text-grey-800 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:uppercase [&_img]:my-2 [&_img]:rounded [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(html[tab]) }}
          />
        ) : (
          <p className="text-xs text-grey-400">{t.ai.previewHint}</p>
        )}
      </div>

      {/* 전체 미리보기 모달 — 실제 고객 상품 상세처럼 렌더 */}
      {showPreview && html[tab] && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-grey-200 pb-3">
              <span className="label-caps text-grey-500">{t.ai.productDetailPreview(LABEL[tab] ?? tab)}</span>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                aria-label="닫기"
                className="text-grey-400 hover:text-black"
              >
                <X size={20} />
              </button>
            </div>
            <div
              className="text-grey-800 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:uppercase [&_h2]:tracking-tight [&_img]:my-4 [&_img]:rounded-lg [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3 [&_p]:leading-relaxed [&_ul]:my-3"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html[tab]) }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
