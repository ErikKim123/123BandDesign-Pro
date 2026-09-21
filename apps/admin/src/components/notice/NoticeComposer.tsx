// 회원 알림 보내기 — 알림관리 페이지와 회원목록(선택 발송)이 같이 쓰는 작성 폼.
//
// 보내는 순서:
//   1) send_member_notice RPC — 받는 사람마다 알림 행을 만든다(권한 검사는 RPC 안의 is_admin()).
//      이 시점에 사이트를 열어둔 회원은 Realtime 으로 즉시 메시지 카드 + 소리를 받는다.
//   2) /api/notices/push — 사이트를 닫아둔 회원에게 웹푸시. 실패해도 1)은 이미 끝났으므로
//      "보냈지만 푸시는 못 나갔다"로만 알린다(알림 자체가 사라지지는 않는다).
'use client';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { createClient } from '@/lib/supabase/client';
import { MemberPicker, type PickedMember } from './MemberPicker';

export interface NoticeTarget {
  /** null = 일반회원 전체 */
  userIds: string[] | null;
  /** 폼 위에 보여줄 대상 설명 (예: "일반회원 전체", "선택한 3명") */
  label: string;
}

interface SendResult {
  sent: number;
  pushed: number | null; // null = 푸시 미설정/실패
  reason?: string;
}

export function NoticeComposer({
  target,
  pickable,
  onSent,
}: {
  /** 고정 대상. pickable 이면 '전체' 모드의 기본값으로만 쓰인다. */
  target: NoticeTarget;
  /**
   * 받는 사람을 이 폼에서 직접 고를 수 있게 한다(알림관리 페이지).
   * 회원목록에서 체크해 넘어온 발송은 대상이 이미 정해져 있으므로 끄고 쓴다.
   */
  pickable?: boolean;
  /** 발송 성공 시 호출 — 목록 새로고침·드로어 닫기 등 호출부가 정한다. */
  onSent?: (result: SendResult) => void;
}) {
  // 'all' = 일반회원 전체 / 'pick' = 검색해서 담은 사람만.
  const [mode, setMode] = useState<'all' | 'pick'>('all');
  const [picked, setPicked] = useState<PickedMember[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  // 영어 판(선택, 0109) — 둘 다 적어야 EN 회원에게 영어로 간다. 비우면 위 제목·본문이 모두에게.
  const [titleEn, setTitleEn] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<SendResult | null>(null);

  // 실제로 보낼 대상 — 고르기 모드면 담은 사람, 아니면 호출부가 준 대상 그대로.
  const picking = Boolean(pickable) && mode === 'pick';
  const effective: NoticeTarget = picking
    ? { userIds: picked.map((m) => m.id), label: `${tr('선택한 회원')} ${picked.length}${tr('명')}` }
    : target;

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !busy &&
    (!picking || picked.length > 0);

  async function send() {
    if (!canSend) return;
    const count = effective.userIds?.length;
    if (
      !window.confirm(
        count == null
          ? tr('일반회원 전체에게 알림을 보낼까요? 되돌릴 수 없습니다.')
          : `${count}${tr('명에게 알림을 보낼까요? 되돌릴 수 없습니다.')}`,
      )
    )
      return;

    setBusy(true);
    setErr(null);
    try {
      const { data, error } = await createClient().rpc('send_member_notice', {
        p_title: title.trim(),
        p_body: body.trim(),
        p_link: link.trim() || null,
        p_user_ids: effective.userIds,
        p_title_en: titleEn.trim() || null,
        p_body_en: bodyEn.trim() || null,
      });
      if (error) {
        setErr(tr(error.message) || tr('발송에 실패했습니다.'));
        return;
      }
      const out = (data ?? {}) as { batch_id?: string; sent?: number };
      const sent = Number(out.sent ?? 0);

      // 웹푸시는 덤이다 — 실패해도 발송 자체는 성공으로 다룬다.
      let pushed: number | null = null;
      let reason: string | undefined;
      if (out.batch_id) {
        try {
          const r = await fetch('/api/notices/push', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ batchId: out.batch_id }),
          });
          const j = (await r.json().catch(() => ({}))) as { sent?: number; reason?: string };
          if (r.ok && typeof j.sent === 'number') pushed = j.sent;
          else reason = j.reason;
        } catch {
          reason = 'push_failed';
        }
      }

      const result: SendResult = { sent, pushed, reason };
      setDone(result);
      setTitle('');
      setBody('');
      setLink('');
      setPicked([]);
      onSent?.(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-grey-200 bg-grey-50 px-4 py-3 text-sm">
        <span className="label-caps text-grey-500">{tr('받는 사람')}</span>
        {pickable ? (
          <>
            {/* 전체 공지와 콕 집어 보내는 알림은 성격이 다르다 — 어느 쪽인지 먼저 고르게 한다. */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['all', tr('일반회원 전체')],
                  ['pick', tr('직접 고르기')],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  aria-pressed={mode === key}
                  className={`rounded-pill border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    mode === key
                      ? 'border-black bg-black text-white'
                      : 'border-grey-300 bg-white text-grey-600 hover:border-grey-400 hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'pick' ? (
              <MemberPicker picked={picked} onChange={setPicked} />
            ) : (
              <p className="font-medium text-ink">{target.label}</p>
            )}
          </>
        ) : (
          <p className="font-medium text-ink">{target.label}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="label-caps" htmlFor="notice-title">
          {tr('제목')}
        </label>
        <input
          id="notice-title"
          className="input"
          value={title}
          maxLength={80}
          placeholder={tr('예: 보홀 대회 참가 신청이 열렸습니다')}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="label-caps" htmlFor="notice-body">
          {tr('내용')}
        </label>
        <textarea
          id="notice-body"
          className="input min-h-32"
          value={body}
          maxLength={1000}
          placeholder={tr('회원 화면에 메시지 카드로 그대로 보입니다. 줄바꿈도 유지됩니다.')}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-grey-200 p-3">
        <p className="text-xs text-grey-500">
          {tr('영어 판 (선택) — 사이트를 영어로 쓰는 회원에게는 이 제목·내용이 갑니다. 둘 다 적어야 적용되고, 비우면 위 내용이 모두에게 갑니다.')}
        </p>
        <div className="space-y-1.5">
          <label className="label-caps" htmlFor="notice-title-en">
            {tr('영어 제목')}
          </label>
          <input
            id="notice-title-en"
            className="input"
            value={titleEn}
            maxLength={80}
            placeholder="e.g. Registration for the Bohol competition is open"
            onChange={(e) => setTitleEn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="label-caps" htmlFor="notice-body-en">
            {tr('영어 내용')}
          </label>
          <textarea
            id="notice-body-en"
            className="input min-h-24"
            value={bodyEn}
            maxLength={1000}
            onChange={(e) => setBodyEn(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="label-caps" htmlFor="notice-link">
          {tr('링크 (선택)')}
        </label>
        <input
          id="notice-link"
          className="input"
          value={link}
          placeholder="https://123band-web.vercel.app/ko/jnj"
          onChange={(e) => setLink(e.target.value)}
        />
        <p className="text-xs text-grey-500">
          {tr('넣으면 메시지에 "보기" 버튼이 붙습니다. 비워 두면 내용만 보입니다.')}
        </p>
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}
      {done && (
        <p className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-ink">
          {done.sent.toLocaleString()}
          {tr('명에게 보냈습니다.')}{' '}
          {done.pushed != null
            ? `${tr('웹푸시')} ${done.pushed.toLocaleString()}${tr('대 발송.')}`
            : tr('(웹푸시는 설정되지 않아 사이트 안에서만 표시됩니다)')}
        </p>
      )}

      <button className="btn btn-primary" disabled={!canSend} onClick={send}>
        <Send size={16} /> {busy ? tr('보내는 중…') : tr('알림 보내기')}
      </button>
    </div>
  );
}
