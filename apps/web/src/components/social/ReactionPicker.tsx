// 소셜 반응 보내기 — QR 로 얻은 상대 코드로만 호출된다.
// 5종(하트·엄지척·댄스·불꽃·박수) 중 하나를 골라, 같은 친구에게 하루 한 번 보낸다(0051).
// 종류를 바꿔도 하루 한 번이다 — 하나를 보내면 나머지 4개도 같이 잠긴다.
// 중복/자기자신/정지 계정 판정은 전부 give_social_heart RPC(DB)가 한다. 여기선 결과만 옮긴다.
//
// 이모지를 누르면 '선택'만 되고, 실제 발송은 아래 [보내기] 버튼이 한다.
// 이모지 탭이 곧 발송이던 구조는 되돌릴 수 없는 동작(하루 1회 제한)을 한 번의 오터치로
// 확정시켜 버려서, 고르는 단계와 보내는 단계를 분리했다.
'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { REACTION_KINDS, REACTION_EMOJI, type ReactionKind } from '@/lib/social/reactions';
import type { Dictionary } from '@/i18n/dictionaries';

export function ReactionPicker({
  code,
  sentKinds,
  t,
}: {
  code: string;
  /** 오늘 이 상대에게 이미 보낸 종류 — 하나라도 있으면 오늘은 더 못 보낸다(하루 1회) */
  sentKinds: ReactionKind[];
  t: Dictionary['social'];
}) {
  const router = useRouter();
  // 푸시 문구를 어느 언어로 만들지 — 호출부(u/[code], 소셜 탭)를 안 고치려고 경로에서 읽는다.
  const locale = usePathname().split('/')[1] === 'ko' ? 'ko' : 'en';
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<ReactionKind | null>(null);
  const [sent, setSent] = useState<ReactionKind[]>(sentKinds);
  const [selected, setSelected] = useState<ReactionKind | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 다른 기기에서 이미 보내 서버가 거절한 경우 — 무엇을 보냈는지는 모르니
  // 체크 표시 없이 잠그기만 한다(sent 에 넣으면 엉뚱한 종류에 체크가 붙는다).
  const [blockedToday, setBlockedToday] = useState(false);
  // 하루 1회 — 종류와 무관하게, 오늘 하나라도 보냈으면 전부 잠긴다.
  const doneToday = sent.length > 0 || blockedToday;

  async function send(kind: ReactionKind) {
    if (busy || doneToday) return;
    setBusy(kind);
    setError(null);
    try {
      const { data, error: err } = await createClient().rpc('give_social_heart', {
        p_code: code,
        p_message: message.trim() || null,
        p_kind: kind,
      });
      const res = (data ?? null) as { ok?: boolean; error?: string } | null;
      if (err || !res) {
        setError(t.errFailed);
        return;
      }
      if (res.ok) {
        setSent((prev) => [...prev, kind]);
        setSelected(null);
        setJustSent(true);
        setMessage('');
        // 받는 사람에게 웹푸시. 부가 동작이라 await 하지 않는다 —
        // 알림 발송이 늦거나 실패해도 "보냈어요" 표시가 밀리면 안 된다.
        void fetch('/api/social/heart-notify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code, kind, locale }),
        }).catch(() => {});
        router.refresh();
        return;
      }
      switch (res.error) {
        case 'already_today':
          // 다른 기기에서 이미 보낸 경우 — 조용히 잠금 상태만 맞춘다
          setBlockedToday(true);
          setSelected(null);
          break;
        case 'self':
          setError(t.errSelf);
          break;
        case 'blocked':
          setError(t.errBlocked);
          break;
        case 'blocked_me':
          setError(t.errBlockedMe);
          break;
        case 'not_found':
          setError(t.notFound);
          break;
        default:
          setError(t.errFailed);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}

      {justSent && (
        <p className="rounded-lg border border-primary/30 bg-cream px-3 py-2 text-center text-sm font-medium text-primary-deep">
          {t.thanks}
        </p>
      )}

      <input
        className="input"
        maxLength={120}
        placeholder={t.messagePlaceholder}
        value={message}
        disabled={doneToday}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div>
        <p className="mb-2 text-center text-xs text-grey-500">
          {doneToday ? t.sentAll : t.pickReaction}
        </p>
        <ul className="grid grid-cols-5 gap-1.5">
          {REACTION_KINDS.map((kind) => {
            // 체크 표시는 실제로 보낸 그 종류에만. 나머지는 잠기기만 한다.
            const done = sent.includes(kind);
            const picked = selected === kind;
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => setSelected(picked ? null : kind)}
                  disabled={doneToday || busy !== null}
                  aria-label={t.reactions[kind]}
                  aria-pressed={picked}
                  className={[
                    'flex w-full flex-col items-center gap-1 rounded-lg border px-1 py-2.5 transition',
                    done
                      ? 'border-primary/40 bg-cream text-primary-deep opacity-60'
                      : doneToday
                        ? 'border-grey-200 opacity-40'
                        : picked
                          ? 'border-primary bg-cream ring-2 ring-primary/30'
                          : 'border-grey-200 hover:border-primary hover:bg-cream-light active:scale-95',
                  ].join(' ')}
                >
                  <span aria-hidden className="text-xl leading-none">
                    {REACTION_EMOJI[kind]}
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] leading-tight text-grey-600">
                    {done && <Check size={10} className="text-primary" aria-hidden />}
                    {t.reactions[kind]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 발송 — 이모지 선택과 분리. 고른 게 없으면 누를 수 없다. */}
      <button
        type="button"
        onClick={() => selected && send(selected)}
        disabled={!selected || busy !== null || doneToday}
        className="btn btn-primary w-full"
      >
        {busy
          ? t.sending
          : selected
            ? `${REACTION_EMOJI[selected]} ${t.send}`
            : t.send}
      </button>

      <p className="text-center text-xs text-grey-500">{t.dailyLimit}</p>
    </div>
  );
}
