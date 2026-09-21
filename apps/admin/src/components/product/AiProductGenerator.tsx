// Design Ref: §5 Phase 3 — 상품 상세 HTML 에디터 (직접 작성 우선) + AI 초안 생성(보조) + 번역
'use client';
import { useState } from 'react';
import { tr } from '@/i18n/tr';
import { Sparkles, Languages, Loader2, ChevronDown, ChevronUp, Code, Eye, X } from 'lucide-react';
import { pickI18n, type I18n, type Locale } from '@123band/shared';
import { sanitizeHtml } from '@/lib/sanitize';
import { useT } from '@/lib/locale/LocaleContext';
import { useGlobalLocale } from '@/lib/locale/active-locale';
import { fmt } from '@/i18n/dict';

// 상품/행사패스 상세는 영문·한글 버전만.
const LOCALES: Locale[] = ['en', 'ko'];
const LABEL: Record<string, string> = { en: 'EN', ko: 'KO' };

// 에디터 빠른 삽입 스니펫 (끝에 append) — 라벨은 사전(aiEditor.snip)에서.
// 본문은 어드민 UI 언어가 아니라 지금 편집 중인 콘텐츠 탭(EN/KO)의 언어로 넣는다.
const SNIPPETS: {
  key: 'heading' | 'paragraph' | 'list' | 'image';
  html: Record<'en' | 'ko', string>; // 상세는 EN/KO 두 탭만 쓴다(LOCALES)
}[] = [
  { key: 'heading', html: { en: '\n<h2>Heading</h2>', ko: '\n<h2>제목</h2>' } },
  { key: 'paragraph', html: { en: '\n<p>Write your text here.</p>', ko: '\n<p>내용을 입력하세요.</p>' } },
  {
    key: 'list',
    html: {
      en: '\n<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>',
      ko: '\n<ul>\n  <li>항목 1</li>\n  <li>항목 2</li>\n</ul>',
    },
  },
  {
    key: 'image',
    html: { en: '\n<img src="https://" alt="" />', ko: '\n<img src="https://" alt="" />' },
  },
];

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
  // 전역 토글(폼 상단)이 있으면 그 로케일을 따른다. 없으면 자체 EN/KO 토글.
  const g = useGlobalLocale();
  const html: I18n = value ?? {};
  const [localTab, setLocalTab] = useState<Locale>('en');
  const tab = g.controlled && g.locale ? g.locale : localTab;
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
  function append(snippet: string) {
    setLang(tab, (html[tab] ?? '') + snippet);
  }

  async function generate() {
    setError(null);
    if (!productName) {
      setError(t.aiEditor.enterNameFirst);
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
      if (!res.ok) throw new Error(data.error ?? t.aiEditor.genFailed);
      setLang('en', data.html);
      setLocalTab('en');
      setShowAi(false);
    } catch (e) {
      setError(e instanceof Error ? tr(e.message) : t.aiEditor.genFailed);
    } finally {
      setLoading(null);
    }
  }

  async function translate(target: Locale) {
    setError(null);
    if (!html.en) {
      setError(t.aiEditor.writeEnFirst);
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
      if (!res.ok) throw new Error(data.error ?? t.aiEditor.transFailed);
      setLang(target, data.html);
    } catch (e) {
      setError(e instanceof Error ? tr(e.message) : t.aiEditor.transFailed);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-grey-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code size={16} />
          <span className="label-caps">{t.aiEditor.title}</span>
        </div>
        {/* AI 초안 생성: 접이식 보조 도구 */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowAi((v) => !v)}
        >
          <Sparkles size={14} /> {t.aiEditor.aiDraft} {showAi ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* AI 생성 패널 (접이식) */}
      {showAi && (
        <div className="space-y-2 rounded-lg bg-grey-50 p-3">
          <p className="text-xs text-grey-500">{t.aiEditor.panelHint}</p>
          <input
            className="input"
            placeholder={t.aiEditor.keywordsPh}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <textarea
            className="input min-h-16"
            placeholder={t.aiEditor.featuresPh}
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
          />
          <textarea
            className="input min-h-12"
            placeholder={t.aiEditor.imageUrlsPh}
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
            {t.aiEditor.generateEn}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 언어: 전역 토글이 있으면 그걸 따르고(탭 숨김), 없으면 자체 EN/KO 토글.
          전역 토글 + EN일 땐 표시할 게 없어 행 자체를 숨긴다. */}
      {(!g.controlled || tab !== 'en') && (
        <div className="flex items-center justify-between border-b border-grey-200">
          <div className="flex gap-1">
            {!g.controlled &&
              LOCALES.map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setLocalTab(l)}
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
              {fmt(t.aiEditor.translateLabel, { lang: LABEL[tab] ?? '' })}
            </button>
          )}
        </div>
      )}

      {/* 빠른 삽입 도구 */}
      <div className="flex flex-wrap gap-1.5">
        {SNIPPETS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => append(s.html[tab === 'ko' ? 'ko' : 'en'])}
            className="rounded-pill border border-grey-300 px-3 py-1 text-xs text-grey-600 hover:border-black hover:text-black"
          >
            + {t.aiEditor.snip[s.key]}
          </button>
        ))}
      </div>

      {/* HTML 에디터 (직접 작성) */}
      <textarea
        className="input min-h-48 font-mono text-xs"
        value={html[tab] ?? ''}
        onChange={(e) => setLang(tab, e.target.value)}
        placeholder={t.aiEditor.editorPlaceholder}
      />

      {/* 라이브 미리보기 (항상) */}
      <div className="rounded-lg border border-grey-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="label-caps text-grey-400">{fmt(t.aiEditor.preview, { lang: LABEL[tab] ?? '' })}</p>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            disabled={!html[tab]}
            className="flex items-center gap-1 text-xs text-grey-500 hover:text-black disabled:opacity-40"
          >
            <Eye size={14} /> {t.aiEditor.fullPreview}
          </button>
        </div>
        {html[tab] ? (
          <div
            className="text-sm text-grey-800 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:uppercase [&_img]:my-2 [&_img]:rounded [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(html[tab]) }}
          />
        ) : (
          <p className="text-xs text-grey-400">{t.aiEditor.previewEmpty}</p>
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
              <span className="label-caps text-grey-500">{fmt(t.aiEditor.detailPreview, { lang: LABEL[tab] ?? '' })}</span>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                aria-label={t.close}
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
