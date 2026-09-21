// 알림함 본문 — 받은 메시지 목록 + 알림음 스위치.
//
// 클라이언트인 이유는 두 가지뿐이다: (1) 들어온 순간 읽음 처리(RPC), (2) 알림음 켜고 끄기
// (기기별 설정이라 localStorage 에 둔다 — 폰에선 켜고 사무실 PC 에선 끄는 게 자연스럽다).
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, ExternalLink, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { setSoundEnabled, soundEnabled } from './sound';
import { NOTICES_READ_EVENT } from './events';
import { localizeNotice } from './localize';

export interface NoticeItem {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  icon_url: string | null;
  title_en: string | null;
  body_en: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NoticesViewStrings {
  title: string;
  empty: string;
  emptyHint: string;
  open: string;
  delete: string;
  deleteAll: string;
  deleteAllConfirm: string;
  sound: string;
  soundOn: string;
  soundOff: string;
}

/** 받은 시각 — 브라우저 현지시간(대개 KST). 로케일 표기를 그대로 따른다. */
function when(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function NoticesView({
  items,
  locale,
  t,
}: {
  items: NoticeItem[];
  locale: string;
  t: NoticesViewStrings;
}) {
  // 서버가 내려준 '안읽음' 표시는 이 화면을 여는 순간의 상태다. 읽음 처리는 뒤에서 돌지만
  // 방금 온 메시지가 어느 것이었는지는 남겨 둬야 눈에 띈다 — 그래서 첫 렌더 값을 그대로 쓴다.
  const markedRef = useRef(false);
  const [sound, setSound] = useState(true);
  const router = useRouter();
  // 지운 알림은 그 자리에서 목록에서 빠진다 — 서버 응답을 기다렸다 사라지면 눌러도 굼떠 보인다.
  const [list, setList] = useState(items);

  useEffect(() => setList(items), [items]);

  // 삭제는 되돌릴 수 없다. RLS(0081)가 자기 행만 지우게 막아 준다.
  // 어느 쪽이든 실패하면 목록에 되돌려 놓는다 — 지운 줄 알았는데 남아 있는 편이,
  // 안 지워졌는데 사라진 것처럼 보이는 것보다 낫다.

  // 모두 지우기 — 화면에 보이는 100건이 아니라 내 알림 전부를 지운다.
  // 한 번에 다 없애는 동작이라 확인을 받는다(주문 삭제와 같은 방식).
  async function removeAll() {
    if (list.length === 0) return;
    if (!window.confirm(t.deleteAllConfirm)) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const before = list;
    setList([]);
    const { error } = await supabase.from('member_notices').delete().eq('user_id', user.id);
    if (error) setList(before);
    else router.refresh();
  }

  /** 한 건 지우기 — 눌린 그 줄이 바로 사라진다(확인 없이). */
  async function remove(id: string) {
    const before = list;
    setList((prev) => prev.filter((n) => n.id !== id));
    const { error } = await createClient().from('member_notices').delete().eq('id', id);
    if (error) setList(before);
    else router.refresh();
  }

  useEffect(() => setSound(soundEnabled()), []);

  // 알림함에 들어왔으면 전부 읽은 것으로 본다. 두 번 부르지 않게 ref 로 막는다.
  // 처리가 끝나면 남아 있는 숫자들을 그 자리에서 0 으로 만든다 — 헤더의 종과 홈 화면 아이콘
  // 배지는 신호로, 서버가 그려 준 탭 배지는 refresh 로. 다 읽고도 숫자가 남아 있으면
  // '아직 못 본 게 있다'는 거짓말이 된다.
  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    void createClient()
      .rpc('mark_notices_read')
      .then(() => {
        window.dispatchEvent(new Event(NOTICES_READ_EVENT));
        router.refresh();
      });
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">{t.title}</h2>
        <div className="flex items-center gap-2">
          {/* 아이콘만 — 문구를 넣으면 영어에서 두 줄로 접히면서 제목 줄을 밀어낸다.
              켬/끔은 종 아이콘의 모양과 색이 말해 주고, 무슨 버튼인지는 길게 눌렀을 때
              뜨는 설명(title)과 스크린리더(aria-label)가 말해 준다. */}
          <button
            type="button"
            onClick={() => {
              const next = !sound;
              setSound(next);
              setSoundEnabled(next);
            }}
            aria-pressed={sound}
            aria-label={`${t.sound}: ${sound ? t.soundOn : t.soundOff}`}
            title={`${t.sound}: ${sound ? t.soundOn : t.soundOff}`}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              sound
                ? 'border-primary/50 text-primary hover:bg-primary/5'
                : 'border-grey-300 text-grey-400 hover:border-grey-400 hover:text-grey-600'
            }`}
          >
            {sound ? <Bell size={16} /> : <BellOff size={16} />}
          </button>
          {list.length > 0 && (
            <button
              type="button"
              onClick={() => void removeAll()}
              aria-label={t.deleteAll}
              title={t.deleteAll}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-grey-300 text-grey-500 transition-colors hover:border-primary hover:text-primary"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-grey-300 bg-cream-light px-6 py-14 text-center">
          <p className="font-display text-lg text-ink">{t.empty}</p>
          <p className="mt-2 text-sm text-grey-500">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((n) => (
            <li
              key={n.id}
              // 흰 배경 위의 흰 카드라 회색 테두리로는 경계가 보이지 않았다. 테두리만 오렌지로
              // 세우고 배경은 흰색 그대로 둔다. 안 읽은 것은 테두리를 더 진하게 + 옅은 바탕으로
              // 구분한다 — 둘 다 오렌지가 되면 읽음/안읽음이 뭉개진다.
              className={`rounded-xl border p-4 ${
                n.read_at ? 'border-primary/45 bg-white' : 'border-primary bg-primary/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    n.read_at ? 'bg-grey-300' : 'bg-primary'
                  }`}
                  aria-hidden
                />
                {n.icon_url && (
                  // 업적 알림의 뱃지 — 배너(NoticeCenter)와 같은 그림을 알림함에서도 보여 준다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.icon_url} alt="" className="h-11 w-11 shrink-0 object-contain" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold text-ink">{localizeNotice(n, locale).title}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-grey-700">
                    {localizeNotice(n, locale).body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-xs text-grey-500">{when(n.created_at, locale)}</span>
                    {n.link_url && (
                      <a
                        href={n.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-4"
                      >
                        {t.open}
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(n.id)}
                  aria-label={t.delete}
                  title={t.delete}
                  className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-grey-400 transition-colors hover:bg-grey-100 hover:text-primary"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
