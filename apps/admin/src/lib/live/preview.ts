// 스위처 프리뷰 주소 판별 — 어드민 입력칸과 스위처 재생 화면이 같은 규칙을 쓴다.
//
// 폰 → OBS 는 SRT 이고 브라우저는 SRT 를 재생하지 못한다. 그래서 프리뷰는 송출 경로와 별개로
// '웹에서 열리는 주소'를 앵글마다 따로 받아 재생한다. 현장 사정에 따라 무엇이 들어올지 모르므로
// 형식을 강제하지 않고, 주소 모양만 보고 재생 방식을 고른다.
//
// 스냅샷(jpg/png)과 MJPEG 를 갈라 두는 이유: 스냅샷은 주기적으로 다시 받아야 움직이고,
// MJPEG 는 이미 흐르는 스트림이라 주소를 건드리면 오히려 끊긴다.
import { youtubeVideoId } from '@123band/shared';

export type PreviewKind = 'youtube' | 'hls' | 'video' | 'mjpeg' | 'snapshot' | 'unknown';

export interface Preview {
  kind: PreviewKind;
  /** 실제로 태그에 넣을 주소 (유튜브는 임베드 주소로 바뀐다) */
  src: string;
  /** 사람에게 보여 줄 짧은 이름 — 입력칸 아래 '유튜브 라이브로 인식' 식으로 쓴다 */
  label: string;
}

const LABEL: Record<PreviewKind, string> = {
  youtube: '유튜브',
  hls: 'HLS',
  video: '동영상 파일',
  mjpeg: 'MJPEG',
  snapshot: '스냅샷 이미지',
  unknown: '알 수 없는 형식',
};

/**
 * 프리뷰 주소 1개를 재생 가능한 형태로 바꾼다. 비어 있으면 null.
 *
 * 유튜브는 반드시 음소거로 띄운다 — 4칸이 동시에 소리를 내면 현장이 무너지고,
 * 애초에 음소거가 아니면 브라우저가 자동재생을 막는다.
 */
export function parsePreview(raw: string | null | undefined): Preview | null {
  const url = (raw ?? '').trim();
  if (!url) return null;

  const yt = youtubeVideoId(url);
  if (yt) {
    const q = 'autoplay=1&mute=1&controls=0&playsinline=1&modestbranding=1&rel=0';
    return { kind: 'youtube', src: `https://www.youtube.com/embed/${yt}?${q}`, label: LABEL.youtube };
  }

  const path = (url.split(/[?#]/)[0] ?? '').toLowerCase();
  const kind: PreviewKind = path.endsWith('.m3u8')
    ? 'hls'
    : /\.(mp4|webm|mov)$/.test(path)
      ? 'video'
      : /mjpe?g/.test(path)
        ? 'mjpeg'
        : /\.(jpe?g|png)$/.test(path)
          ? 'snapshot'
          : 'unknown';

  return { kind, src: url, label: LABEL[kind] };
}
