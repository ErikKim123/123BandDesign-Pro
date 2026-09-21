// 알림음 — 소리 파일을 두지 않고 WebAudio 로 두 음을 짧게 낸다.
//
// mp3 를 쓰지 않는 이유: 첫 알림에서 파일을 받으러 가느라 소리가 늦게 나고(그때가 제일 중요하다),
// 캐시가 없으면 아예 안 울린다. 합성음은 파일도 요청도 없이 그 자리에서 난다.
//
// 브라우저는 사용자가 한 번도 건드리지 않은 페이지에서 소리를 막는다(자동재생 정책).
// 막히면 조용히 넘어간다 — 카드와 배지는 그대로 뜨므로 알림 자체를 놓치지는 않는다.

const KEY = 'band.noticeSound'; // '0' 이면 끔. 기기별 설정이라 서버에 두지 않는다.

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // 사파리 프라이빗 등 — 소리는 이번 세션에만 유지된다
  }
}

let ctx: AudioContext | null = null;

/** '띵-동' 두 음. 알림 카드가 뜰 때 한 번 부른다. */
export function playNoticeSound(): void {
  if (!soundEnabled()) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    // 880Hz → 1320Hz. 짧고 맑은 두 음이라 페이지 소리(영상 등)와 섞여도 알림으로 들린다.
    [
      { at: 0, hz: 880 },
      { at: 0.14, hz: 1320 },
    ].forEach(({ at, hz }) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      // 딸깍 소리가 나지 않게 올렸다 내린다.
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.22);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.24);
    });
  } catch {
    // 소리를 못 내는 환경 — 알림 표시는 그대로 진행한다
  }
}

/**
 * 짧게 두 번 — 소리와 같은 스위치를 따른다(끄면 조용히·잠잠히).
 *
 * 아이폰(사파리)에는 이 API 가 없어 아무 일도 일어나지 않는다. 아이폰에서 진동이 오는 건
 * 앱을 닫아 둔 사이 도착하는 시스템 푸시 알림이고, 그건 iOS 알림 설정이 정한다.
 */
export function buzzNotice(): void {
  if (!soundEnabled()) return;
  try {
    navigator.vibrate?.([12, 90, 12]);
  } catch {
    // 진동을 못 하는 환경 — 알림 표시는 그대로 진행한다
  }
}
