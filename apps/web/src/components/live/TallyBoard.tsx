// 탈리 화면 — OBS 오퍼레이터가 보는 전체화면 지시판.
//
// 모드 A(지시)의 핵심 장치다. 감독이 스위처에서 고른 앵글이 여기에 크게 뜨고, 오퍼레이터가
// 그 씬으로 바꾼다. 노트북에 로그인 세션을 남기지 않도록 토큰 URL 로만 연다.
//
// 이 화면만 다크 배경을 쓴다 — 3m 밖에서도 읽혀야 하고, 어두운 현장에서 흰 화면은 눈을 버린다.
// 색은 기존 토큰(ink/live/white/grey)만 쓴다.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Dictionary } from '@/i18n/dictionaries';
import type { TallyState } from '@/lib/queries/live';

/** 지시가 바뀐 순간에만 짧게 울린다. 오디오 파일 없이 WebAudio 로 만든다(에셋 추가 없음). */
function beep() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    osc.onended = () => void ctx.close();
  } catch {
    // 자동재생 정책 등으로 막히면 화면 플래시만으로 알린다.
  }
}

export function TallyBoard({
  token,
  initial,
  dict,
}: {
  token: string;
  initial: TallyState;
  dict: Dictionary;
}) {
  const [state, setState] = useState<TallyState>(initial);
  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState(false);
  const lastProgram = useRef<string | null>(initial.program?.id ?? null);

  const apply = useCallback(
    (next: TallyState) => {
      setState(next);
      const nextId = next.program?.id ?? null;
      if (nextId !== lastProgram.current) {
        lastProgram.current = nextId;
        setFlash(true);
        setTimeout(() => setFlash(false), 700);
        if (!muted) beep();
      }
    },
    [muted],
  );

  // 1초 폴링 — 지시는 1초 안에 따라와야 한다. 함수 호출 한 번이라 현장 노트북에 부담이 없고,
  // Realtime 이 막힌 망(현장 와이파이)에서도 확실히 동작한다.
  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const tick = async () => {
      const { data } = await supabase.rpc('live_tally_state', { p_token: token });
      if (alive && data) apply(data as unknown as TallyState);
    };
    const timer = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token, apply]);

  const t = dict.live.tally;
  const program = state.program;

  return (
    <div
      className={`flex min-h-screen flex-col bg-ink text-white transition-colors duration-200 ${
        flash ? 'bg-primary' : ''
      }`}
    >
      <div className="flex items-center justify-between px-6 py-4 text-sm text-white/60">
        <span className="uppercase tracking-[2px]">{t.title}</span>
        <div className="flex items-center gap-4">
          {state.segment && (
            <span className="rounded-pill bg-white/10 px-3 py-1 text-base text-white">
              {state.segment}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? t.unmute : t.mute}
            className="flex h-9 w-9 items-center justify-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {program ? (
          <>
            <span className="font-display text-[22vw] font-extrabold leading-none tracking-tight text-primary md:text-[18vw]">
              {program.slot}
            </span>
            <span className="mt-2 font-display text-[7vw] font-bold uppercase leading-tight tracking-tight md:text-[5vw]">
              {program.label}
            </span>
            {program.operator_name && (
              <span className="mt-3 text-[2.4vw] text-white/60 md:text-[1.6vw]">
                {program.operator_name}
              </span>
            )}
          </>
        ) : (
          <span className="font-display text-[6vw] font-bold uppercase tracking-tight text-white/50">
            {t.waiting}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between px-6 py-4 text-sm text-white/40">
        <span>{state.status === 'live' ? t.onAir : t.standby}</span>
        <span>{state.switch_mode === 'b' ? t.modeB : t.modeA}</span>
      </div>
    </div>
  );
}
