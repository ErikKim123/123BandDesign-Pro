// 메일링 관리 — 미리보기 + 테스트 발송 패널.
//
// 저장된 값이 아니라 '지금 입력 중인 값'을 렌더한다. 저장해야만 확인할 수 있으면
// 운영자가 실수한 문구를 실제 메일로 내보낸 뒤에야 알게 된다.
'use client';
import { useMemo, useState } from 'react';
import { Eye, Send, TriangleAlert } from 'lucide-react';
import { tr } from '@/i18n/tr';
import {
  renderMailBody,
  sampleVars,
  unknownVariables,
  type MailVariable,
} from '@123band/shared';

type Values = Record<string, unknown>;

function asI18n(v: unknown): { ko?: string; en?: string } {
  return v && typeof v === 'object' ? (v as { ko?: string; en?: string }) : {};
}

function asVariables(v: unknown): MailVariable[] {
  if (Array.isArray(v)) return v as MailVariable[];
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as MailVariable[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function MailPreviewPanel({ values }: { values: Values }) {
  const audience = (values.audience as string) === 'user' ? 'user' : 'admin';
  const [locale, setLocale] = useState<'ko' | 'en'>('ko');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const vars = useMemo(() => asVariables(values.variables), [values.variables]);

  const { subjectTpl, bodyTpl } = useMemo(() => {
    if (audience === 'user') {
      return {
        subjectTpl: asI18n(values.subject_i18n)[locale] ?? '',
        bodyTpl: asI18n(values.body_html_i18n)[locale] ?? '',
      };
    }
    return {
      subjectTpl: (values.subject as string) ?? '',
      bodyTpl: (values.body_html as string) ?? '',
    };
  }, [audience, locale, values]);

  const preview = useMemo(() => {
    // 고객 메일은 언어별 예시값을 쓴다 — EN 미리보기에 한국어 상품명이 박히지 않게.
    const sample = sampleVars(vars, audience === 'user' ? locale : undefined);
    return {
      subject: renderMailBody(subjectTpl, sample).replace(/<[^>]+>/g, '').trim(),
      html: renderMailBody(bodyTpl, sample),
      unknown: unknownVariables(`${subjectTpl} ${bodyTpl}`, vars),
    };
  }, [subjectTpl, bodyTpl, vars, audience, locale]);

  const missing = !subjectTpl.trim() || !bodyTpl.trim();

  async function sendTest() {
    const email = to.trim();
    if (!email.includes('@')) {
      setMsg({ ok: false, text: tr('받을 주소를 정확히 입력해 주세요.') });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/mail-templates/test-send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // 저장 전 값 그대로 보낸다 — 화면에서 본 것과 같은 메일이 가야 한다.
        body: JSON.stringify({ to: email, subject: preview.subject, html: preview.html, audience }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || String(res.status));
      setMsg({ ok: true, text: `${email} — ${tr('보냈습니다. 스팸함도 확인해 보세요.')}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-caps flex items-center gap-1.5">
          <Eye size={14} /> {tr('미리보기 · 테스트 발송')}
        </span>
        {audience === 'user' && (
          <div className="flex gap-1">
            {(['ko', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className={`rounded-pill px-3 py-1 text-xs font-semibold uppercase transition-colors ${
                  locale === l ? 'bg-black text-white' : 'bg-grey-100 text-grey-500 hover:text-black'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-grey-500">
        {tr("저장하기 전 입력값을 그대로 렌더합니다. 변수는 아래 '쓸 수 있는 변수'의 예시 값으로 채워집니다.")}
      </p>

      {preview.unknown.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-md bg-live/10 px-3 py-2 text-xs text-live">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          <span>
            {tr('정의되지 않은 변수')}: <b>{preview.unknown.join(', ')}</b> —{' '}
            {tr('오타이거나 변수 목록에 빠졌습니다. 이대로 보내면 그 자리는 빈칸으로 나갑니다.')}
          </span>
        </p>
      )}

      {missing ? (
        <p className="rounded-md border border-dashed border-grey-300 px-3 py-6 text-center text-xs text-grey-400">
          {audience === 'user'
            ? `${locale.toUpperCase()} — ${tr('제목과 본문을 채우면 미리보기가 나옵니다.')}`
            : tr('제목과 본문을 채우면 미리보기가 나옵니다.')}
          <br />
          {tr('비어 있으면 이 메일은 코드의 기본 문구로 나갑니다.')}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-grey-200">
          <div className="border-b border-grey-100 bg-grey-50 px-3 py-2">
            <p className="text-[11px] text-grey-500">{tr('제목')}</p>
            <p className="text-sm font-semibold text-grey-800">{preview.subject || tr('(비어 있음)')}</p>
          </div>
          {/* 메일 본문은 실제 메일함처럼 항상 흰 배경 — 발신 HTML 이 밝은 배경을 전제로 짜여 있다 */}
          <div className="max-h-[420px] overflow-auto bg-white p-4">
            <div
              className="mx-auto max-w-[560px] text-[14px] leading-relaxed text-[#1a1a1a]"
              // 운영자가 직접 쓴 메일 본문 HTML 이다. 어드민 전용 화면이고, 저장은 운영자만 가능하다.
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-52"
          type="email"
          placeholder={tr('테스트로 받을 이메일')}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || missing}
          onClick={sendTest}
          className="inline-flex items-center gap-1.5 rounded-pill bg-black px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          <Send size={14} /> {busy ? tr('보내는 중…') : tr('테스트 발송')}
        </button>
      </div>

      {msg && (
        <p className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>
      )}
    </div>
  );
}
