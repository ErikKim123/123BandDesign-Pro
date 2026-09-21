// 뉴스레터 — 구독자 목록 + 작성(제목/내용) + 예약/발송 + 발송 내역. 어드민 전용.
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { tr } from '@/i18n/tr';
import { Send, Save, Eye, Users, Clock, X, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeHtml } from '@/lib/sanitize';
import { useLocale } from '@/lib/locale/LocaleContext';

interface Subscriber {
  id: string;
  email: string;
  locale: string | null;
  created_at: string;
}
interface Newsletter {
  id: string;
  subject: string;
  content_html: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  created_at: string;
}

const STR = {
  ko: {
    title: '뉴스레터',
    subscribers: '구독자',
    people: '명',
    email: '이메일',
    lang: '언어',
    joined: '구독일',
    noSubs: '구독자가 없습니다.',
    compose: '새 뉴스레터 작성',
    composeEdit: '뉴스레터 수정',
    editingHint: '저장된 뉴스레터를 불러왔습니다. 수정 후 임시저장하거나 예약/발송하세요.',
    newOne: '새로 작성',
    saveSchedule: '예약 저장',
    subject: '제목',
    subjectPh: '메일 제목을 입력하세요',
    content: '내용 (HTML)',
    contentPh: '<h2>안녕하세요</h2><p>이번 달 소식을 전해드립니다…</p>',
    preview: '미리보기',
    schedule: '예약 발송 (선택)',
    scheduleHint: '예약 시각을 지정하면 그 시각에 자동 발송됩니다(없으면 즉시).',
    saveDraft: '임시저장',
    sendNow: '보내기',
    previewBtn: '미리보기',
    previewTitle: '메일 미리보기',
    noSubjectPreview: '(제목 없음)',
    close: '닫기',
    sending: '발송 중…',
    saved: '저장되었습니다.',
    scheduled: '예약되었습니다.',
    sentOk: (n: number) => `${n}명에게 발송했습니다.`,
    confirmSend: (n: number) => `구독자 ${n}명에게 지금 보낼까요?`,
    needSubject: '제목을 입력하세요.',
    history: '발송 내역',
    hSubject: '제목',
    hStatus: '상태',
    hSchedule: '예약',
    hSent: '발송',
    hRecipients: '수신',
    send: '보내기',
    edit: '편집',
    del: '삭제',
    confirmDel: '이 뉴스레터를 삭제할까요?',
    needSchedule: '예약 시각(미래)을 지정하세요.',
    noHistory: '내역이 없습니다.',
    stDraft: '임시',
    stScheduled: '예약',
    stSent: '발송됨',
    due: '도래',
    fail: '실패',
  },
  en: {
    title: 'Newsletter',
    subscribers: 'Subscribers',
    people: '',
    email: 'Email',
    lang: 'Lang',
    joined: 'Subscribed',
    noSubs: 'No subscribers yet.',
    compose: 'Compose newsletter',
    composeEdit: 'Edit newsletter',
    editingHint: 'Loaded a saved newsletter. Edit then save draft, schedule, or send.',
    newOne: 'New',
    saveSchedule: 'Save schedule',
    subject: 'Subject',
    subjectPh: 'Enter the email subject',
    content: 'Content (HTML)',
    contentPh: '<h2>Hello</h2><p>Here is this month’s update…</p>',
    preview: 'Preview',
    schedule: 'Schedule (optional)',
    scheduleHint: 'Set a time to auto-send then; otherwise sends immediately.',
    saveDraft: 'Save draft',
    sendNow: 'Send',
    previewBtn: 'Preview',
    previewTitle: 'Email preview',
    noSubjectPreview: '(No subject)',
    close: 'Close',
    sending: 'Sending…',
    saved: 'Saved.',
    scheduled: 'Scheduled.',
    sentOk: (n: number) => `Sent to ${n} subscribers.`,
    confirmSend: (n: number) => `Send to ${n} subscribers now?`,
    needSubject: 'Enter a subject.',
    history: 'History',
    hSubject: 'Subject',
    hStatus: 'Status',
    hSchedule: 'Scheduled',
    hSent: 'Sent',
    hRecipients: 'Recipients',
    send: 'Send',
    edit: 'Edit',
    del: 'Delete',
    confirmDel: 'Delete this newsletter?',
    needSchedule: 'Pick a future schedule time.',
    noHistory: 'No history.',
    stDraft: 'Draft',
    stScheduled: 'Scheduled',
    stSent: 'Sent',
    due: 'due',
    fail: 'Failed',
  },
};

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function NewsletterPage() {
  const { locale } = useLocale();
  const s = locale === 'ko' ? STR.ko : STR.en;
  const supabase = useMemo(() => createClient(), []);

  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [list, setList] = useState<Newsletter[]>([]);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: sub }, { data: nl }] = await Promise.all([
      supabase.from('newsletter_subscribers').select('id, email, locale, created_at').order('created_at', { ascending: false }),
      supabase.from('newsletters').select('*').order('created_at', { ascending: false }),
    ]);
    setSubs((sub as Subscriber[]) ?? []);
    setList((nl as Newsletter[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // 예약 도래분 자동 발송 — 화면이 열려 있는 동안 1분마다 처리하고, 발송됐으면 목록 갱신.
  // (운영에선 /api/newsletter/cron 이 별도로 돈다. 이건 어드민이 화면을 켜둔 동안의 보조 트리거.)
  useEffect(() => {
    let stop = false;
    async function runDue() {
      try {
        const res = await fetch('/api/newsletter/run-due', { method: 'POST' });
        const d = (await res.json().catch(() => ({}))) as { processed?: unknown[] };
        if (!stop && Array.isArray(d.processed) && d.processed.length > 0) await load();
      } catch {
        /* 무시 — 다음 주기에 재시도 */
      }
    }
    runDue();
    const t = setInterval(runDue, 60_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [load]);

  function reset() {
    setSubject('');
    setContent('');
    setScheduledAt('');
    setEditingId(null);
  }

  // ISO(또는 timestamptz) → datetime-local 입력값(YYYY-MM-DDTHH:mm, 로컬시간)
  function toDatetimeLocal(v: string | null): string {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // 저장된 뉴스레터를 작성 폼으로 불러와 편집 모드로 전환.
  function loadForEdit(n: Newsletter) {
    setEditingId(n.id);
    setSubject(n.subject);
    setContent(n.content_html);
    setScheduledAt(toDatetimeLocal(n.scheduled_at));
    setErr(null);
    setMsg(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeNewsletter(id: string) {
    if (!window.confirm(s.confirmDel)) return;
    setErr(null);
    setMsg(null);
    const { error } = await supabase.from('newsletters').delete().eq('id', id);
    if (error) return setErr(error.message);
    if (editingId === id) reset();
    await load();
  }

  // HTML 저장 포인트 — 편집 중이면 그 행을 갱신(저장된 콘텐츠 수정), 아니면 새 임시저장 행 생성.
  async function saveDraft() {
    setErr(null);
    setMsg(null);
    if (!subject.trim()) return setErr(s.needSubject);
    setBusy(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('newsletters')
          .update({ subject: subject.trim(), content_html: content, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('newsletters').insert({
          subject: subject.trim(),
          content_html: content,
          status: 'draft',
        });
        if (error) throw new Error(error.message);
      }
      setMsg(s.saved);
      reset();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? tr(e.message) : s.fail);
    } finally {
      setBusy(false);
    }
  }

  async function send(
    payload: { id?: string; subject?: string; content_html?: string; scheduled_at?: string },
    fromCompose = false,
  ) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; scheduled?: boolean; count?: number; error?: string };
      if (!res.ok || !d.ok) throw new Error(d.error || s.fail);
      setMsg(d.scheduled ? s.scheduled : s.sentOk(d.count ?? 0));
      // 작성 폼(신규/편집)에서 보냈으면 폼 비우고 편집 모드 종료. 내역 인라인 발송은 폼 유지.
      if (fromCompose || !payload.id) reset();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? tr(e.message) : s.fail);
    } finally {
      setBusy(false);
    }
  }

  // 작성 폼에서 발송/예약. 편집 중이면 그 행(id)을 갱신·발송, 아니면 새로 만든다.
  // 예약 시각이 미래면 예약 저장, 아니면 즉시 발송(확인).
  function submitCompose() {
    if (!subject.trim()) return setErr(s.needSubject);
    const future = !!(scheduledAt && new Date(scheduledAt).getTime() > Date.now());
    if (!future && !window.confirm(s.confirmSend(subs.length))) return;
    send(
      {
        id: editingId ?? undefined,
        subject: subject.trim(),
        content_html: content,
        scheduled_at: scheduledAt || undefined,
      },
      true,
    );
  }

  // 예약만 저장(발송하지 않음) — 미래 시각이 반드시 필요.
  function onSaveSchedule() {
    if (!subject.trim()) return setErr(s.needSubject);
    const future = !!(scheduledAt && new Date(scheduledAt).getTime() > Date.now());
    if (!future) return setErr(s.needSchedule);
    send(
      {
        id: editingId ?? undefined,
        subject: subject.trim(),
        content_html: content,
        scheduled_at: scheduledAt,
      },
      true,
    );
  }

  const statusLabel = (st: Newsletter['status']) =>
    st === 'sent' ? s.stSent : st === 'scheduled' ? s.stScheduled : s.stDraft;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl">{s.title}</h1>
      {err && <p className="text-sm text-danger">{err}</p>}
      {msg && <p className="text-sm text-success">{msg}</p>}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 작성 */}
        <section className="space-y-4 rounded-lg border border-grey-200 p-5">
          <div className="flex items-center justify-between">
            <h2 className="label-caps">{editingId ? s.composeEdit : s.compose}</h2>
            {editingId && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
                {s.newOne}
              </button>
            )}
          </div>
          {editingId && <p className="text-[11px] text-grey-400">{s.editingHint}</p>}
          <div className="space-y-1.5">
            <label className="label-caps">{s.subject}</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={s.subjectPh} />
          </div>
          <div className="space-y-1.5">
            <label className="label-caps">{s.content}</label>
            <textarea
              className="input min-h-48 font-mono text-xs"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={s.contentPh}
            />
          </div>
          {/* 미리보기 */}
          <div className="rounded-lg border border-grey-200 p-3">
            <p className="mb-2 flex items-center gap-1 label-caps text-grey-400">
              <Eye size={13} /> {s.preview}
            </p>
            {content ? (
              <div
                className="text-sm text-grey-800 [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-lg [&_img]:my-2 [&_img]:max-w-full [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
              />
            ) : (
              <p className="text-xs text-grey-400">—</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 label-caps">
              <Clock size={13} /> {s.schedule}
            </label>
            <input type="datetime-local" className="input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            <p className="text-[11px] text-grey-400">{s.scheduleHint}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={saveDraft}>
              <Save size={15} /> {s.saveDraft}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPreview(true)}>
              <Eye size={15} /> {s.previewBtn}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onSaveSchedule}>
              <Clock size={15} /> {s.saveSchedule}
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={submitCompose}>
              <Send size={15} /> {busy ? s.sending : s.sendNow}
            </button>
          </div>
        </section>

        {/* 구독자 */}
        <section className="space-y-3 rounded-lg border border-grey-200 p-5">
          <h2 className="flex items-center gap-2 label-caps">
            <Users size={15} /> {s.subscribers}
            <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-xs text-grey-600">
              {subs.length}
              {s.people}
            </span>
          </h2>
          {subs.length === 0 ? (
            <p className="text-sm text-grey-500">{s.noSubs}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded border border-grey-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-grey-50">
                  <tr className="border-b border-grey-200 text-left label-caps">
                    <th className="px-3 py-2">{s.email}</th>
                    <th className="px-3 py-2">{s.lang}</th>
                    <th className="px-3 py-2">{s.joined}</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((u) => (
                    <tr key={u.id} className="border-b border-grey-100">
                      <td className="px-3 py-2">{u.email}</td>
                      <td className="px-3 py-2 uppercase text-grey-500">{u.locale || '—'}</td>
                      <td className="px-3 py-2 text-grey-500">{fmtDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* 발송 내역 */}
      <section className="space-y-3">
        <h2 className="label-caps">{s.history}</h2>
        <div className="overflow-x-auto rounded-lg border border-grey-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200 bg-grey-50 text-left label-caps">
                <th className="px-4 py-3">{s.hSubject}</th>
                <th className="px-4 py-3">{s.hStatus}</th>
                <th className="px-4 py-3">{s.hSchedule}</th>
                <th className="px-4 py-3">{s.hSent}</th>
                <th className="px-4 py-3">{s.hRecipients}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-grey-500">
                    {s.noHistory}
                  </td>
                </tr>
              ) : (
                list.map((n) => {
                  const due = n.status === 'scheduled' && n.scheduled_at && new Date(n.scheduled_at).getTime() <= Date.now();
                  return (
                    <tr key={n.id} className="border-b border-grey-100">
                      <td className="px-4 py-3 font-medium">{n.subject}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-pill bg-grey-100 px-2 py-0.5 text-xs">{statusLabel(n.status)}</span>
                        {due && <span className="ml-1 text-xs text-danger">· {s.due}</span>}
                      </td>
                      <td className="px-4 py-3 text-grey-500">{fmtDate(n.scheduled_at)}</td>
                      <td className="px-4 py-3 text-grey-500">{fmtDate(n.sent_at)}</td>
                      <td className="px-4 py-3 text-grey-500">{n.status === 'sent' ? n.recipient_count : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {n.status !== 'sent' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={busy}
                                onClick={() => loadForEdit(n)}
                              >
                                <Pencil size={14} /> {s.edit}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={busy}
                                onClick={() => {
                                  if (window.confirm(s.confirmSend(subs.length))) send({ id: n.id });
                                }}
                              >
                                <Send size={14} /> {s.send}
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => removeNewsletter(n.id)}
                          >
                            <Trash2 size={14} /> {s.del}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 미리보기 모달 */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-grey-200 px-5 py-3">
              <h3 className="flex items-center gap-1.5 label-caps">
                <Eye size={15} /> {s.previewTitle}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPreview(false)}
              >
                <X size={15} /> {s.close}
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <p className="mb-4 border-b border-grey-100 pb-3 font-display text-xl">
                {subject.trim() || <span className="text-grey-400">{s.noSubjectPreview}</span>}
              </p>
              {content ? (
                <div
                  className="text-sm text-grey-800 [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-lg [&_img]:my-2 [&_img]:max-w-full [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
                />
              ) : (
                <p className="text-sm text-grey-400">—</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
