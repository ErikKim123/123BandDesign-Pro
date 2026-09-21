// [원본 동기화] apps/web/src/components/account/CharacterAvatar.tsx 의 복사본.
// import 경로만 어드민 기준(@/lib/avatar)으로 맞췄고 그리기 로직은 원본과 동일하다.
// 아트가 바뀌면 web 원본과 함께 고친다 — 어긋나면 어드민이 회원과 다른 얼굴을 보게 된다.
// 캐릭터 아바타 — 플랫 벡터 얼굴. avatar_seed + avatar_traits 로 결정되는 SVG.
// 훅/브라우저 API 를 쓰지 않아 서버·클라이언트 컴포넌트 양쪽에서 그대로 쓴다(하이드레이션 안전).
// 외부 이미지 의존 없음.
//
// 아트 방향
// · 평면 색 위주. 음영/하이라이트는 같은 색의 어두운·밝은 톤 한 겹씩만(shade/tint).
//   그라디언트를 쓰면 스타일이 흐려지고 40px 로 줄였을 때 지저분해진다.
// · 얼굴은 모서리가 크게 둥근 사각형. 귀는 옆에 붙은 원.
// · 머리는 '뒷머리 한 덩어리 + 앞머리(이마를 덮는 면)' 두 겹이다. 두 겹 모두
//   같은 사각형에서 파생시켜 폭이 정확히 맞물린다 — 옛 버전은 옆머리를 별도
//   막대로 그려서 헤어라인과 옆머리 사이에 살색 틈이 생기고 아래가 끊겼다.
// · 헤어라인은 완전한 직선이 아니라 가운데가 살짝 내려온 곡선이다. 직선으로만
//   자르면 가발을 씌운 것처럼 보인다.
//
// 레이어: 배경 → 어깨 → 목 → 뒷머리(+묶은머리) → 귀 → 얼굴 → 앞머리(+하이라이트)
//         → 눈썹 → 눈 → 코 → 입 → 수염 → 안경
import { avatarSpec, parseTraits, shade, tint, type AvatarSpec } from '@/lib/avatar';

const INK = '#2f3542';

/** 얼굴 사각형 4종 — [x, 너비, 높이, 모서리 반경] */
const FACE_SHAPES: [number, number, number, number][] = [
  [30, 40, 46, 15], // 둥근사각
  [28, 44, 44, 13], // 넓은사각
  [32, 36, 47, 15], // 갸름
  [30, 40, 46, 8], // 각진
];
const FACE_TOP = 18;
const BROW_Y = 31;
const EYE_Y = 41;
const NOSE_Y = 47;
const MOUTH_Y = 53;
const EYE_DX = 8.4;
const EAR_Y = 43;

type Face = { x: number; y: number; w: number; h: number; rx: number; cx: number; bottom: number };

export function CharacterAvatar({
  seed,
  traits,
  size = 96,
  className,
  label,
  photoUrl,
}: {
  seed: string | null | undefined;
  /** DB jsonb 를 그대로 받는다 — 신뢰하지 않고 여기서 걸러 읽는다(parseTraits). */
  traits?: unknown;
  size?: number;
  className?: string;
  label?: string;
  /** 회원이 올린 프로필 사진(profiles.avatar_url). 있으면 캐릭터 대신 이 사진을 쓴다(web 원본과 동일). */
  photoUrl?: string | null;
}) {
  // 사진 우선 — 회원이 고객 사이트에서 보는 얼굴과 어드민이 보는 얼굴이 같아야 한다.
  // 관리자 내부 도구라 next/image 대신 img 를 쓴다(스토리지 도메인 최적화 대상 아님).
  if (photoUrl) {
    return (
      <span
        className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-grey-100 ${className ?? ''}`}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={label ?? 'profile photo'} className="h-full w-full object-cover" />
      </span>
    );
  }

  const s = avatarSpec(seed, parseTraits(traits));
  const shape = FACE_SHAPES[s.faceShape] ?? FACE_SHAPES[0];
  if (!shape) return null;
  const [fx, fw, fh, frx] = shape;
  const face: Face = {
    x: fx,
    y: FACE_TOP,
    w: fw,
    h: fh,
    rx: frx,
    cx: 50,
    bottom: FACE_TOP + fh,
  };
  const key = `${seed || 'wolf'}-${s.faceShape}${s.eyes}${s.hairStyle}${s.glasses}${s.beard}`;
  const gid = `av-${key.replace(/[^a-zA-Z0-9]/g, '').slice(0, 22) || 'x'}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label ?? 'character'}
    >
      <defs>
        <clipPath id={`${gid}-round`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        <clipPath id={`${gid}-face`}>
          <rect x={face.x} y={face.y} width={face.w} height={face.h} rx={face.rx} />
        </clipPath>
        <clipPath id={`${gid}-hair`}>
          <rect
            x={face.x - HAIR_PAD}
            y={face.y - HAIR_PAD}
            width={face.w + HAIR_PAD * 2}
            height={face.h + HAIR_PAD * 2}
            rx={face.rx + HAIR_PAD}
          />
        </clipPath>
      </defs>

      <g clipPath={`url(#${gid}-round)`}>
        <rect x="0" y="0" width="100" height="100" fill={s.bg} />
        <Body s={s} face={face} />
        <BackHair s={s} face={face} />
        <Ears s={s} face={face} />
        <rect x={face.x} y={face.y} width={face.w} height={face.h} rx={face.rx} fill={s.skin} />
        <FrontHair s={s} face={face} gid={gid} />
        <Brows s={s} />
        <Eyes s={s} />
        <Nose s={s} />
        <Mouth s={s} />
        <Beard s={s} face={face} gid={gid} />
        <Glasses s={s} />
      </g>
    </svg>
  );
}

/** 머리 실루엣이 얼굴보다 넓은 정도 — 이 여백이 옆머리로 보인다. */
const HAIR_PAD = 3.4;

/**
 * 목 + 어깨.
 * 목을 짧은 막대로 끊고 어깨를 그 아래 붙이면 목이 어깨 위에 얹힌 막대처럼 보인다
 * (실기기에서 그렇게 보였다). 그래서
 *   · 목을 아래로 길게 빼서 화면 밖까지 내리고,
 *   · 어깨는 그 위에 덮되 가운데를 파낸 목선(collar)을 만들어
 *     목이 옷 속으로 들어가는 것처럼 이어지게 한다.
 * 어깨는 좌우 화면 밖까지 나가야 '상반신'으로 읽힌다(돔이 되면 안 된다).
 */
function Body({ s, face }: { s: AvatarSpec; face: Face }) {
  const neckTop = face.bottom - 9;
  return (
    <g>
      {/* 목 — 아래로 길게. 끝을 화면 밖에 두면 어디서 끊겼는지 보이지 않는다 */}
      <path
        d={`M43 ${neckTop} L57 ${neckTop} L60 102 L40 102 Z`}
        fill={s.skin}
      />
      {/* 턱 그림자 — 목이 얼굴에 납작하게 붙어 보이지 않게 한 겹만 */}
      <path d={`M43 ${neckTop} L57 ${neckTop} L57.6 ${neckTop + 5} L42.4 ${neckTop + 5} Z`} fill={shade(s.skin, 0.86)} />
      {/* 상의 — 가운데가 파인 목선이라 목이 옷 속으로 이어진다 */}
      <path
        d={`M-8 102 L-8 90 Q10 79 28 78 Q38 77.5 41 84 Q50 91 59 84 Q62 77.5 72 78 Q90 79 108 90 L108 102 Z`}
        fill={s.shirt}
      />
      {/* 목선 안쪽 그늘 — 옷깃이 목보다 앞에 있다는 걸 알려준다 */}
      <path d={`M41 84 Q50 91 59 84 Q50 88 41 84 Z`} fill={shade(s.shirt, 0.8)} />
    </g>
  );
}

function Ears({ s, face }: { s: AvatarSpec; face: Face }) {
  return (
    <g>
      <circle cx={face.x + 0.5} cy={EAR_Y} r="5.6" fill={s.skin} />
      <circle cx={face.x + face.w - 0.5} cy={EAR_Y} r="5.6" fill={s.skin} />
      {/* 귓속 — 원 하나로는 덩어리로 보인다 */}
      <path
        d={`M${face.x + 1.5} ${EAR_Y - 2} a2.4 2.4 0 0 0 0 4.4`}
        fill="none"
        stroke={shade(s.skin, 0.86)}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d={`M${face.x + face.w - 1.5} ${EAR_Y - 2} a2.4 2.4 0 0 1 0 4.4`}
        fill="none"
        stroke={shade(s.skin, 0.86)}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </g>
  );
}

// ── 머리 ──────────────────────────────────────────────────────────────────────
// 0 짧은머리 · 1 단발 · 2 롱 · 3 곱슬 · 4 아프로퍼프 · 5 올림머리 · 6 포니테일 · 7 대머리

/** 스타일별 기장(뒷머리 아래 끝 y). 짧은 스타일은 귀 위에서 끝난다. */
function hairLength(style: number, face: Face): number {
  if (style === 2 || style === 8 || style === 10) return 98; // 롱 계열 — 화면 밖까지
  if (style === 9) return 82; // 양갈래 — 묶은 자리 아래에서 끊는다
  if (style === 1) return face.bottom + 1; // 단발 — 턱선
  if (style === 5) return EAR_Y - 5; // 올림머리 — 귀를 드러낸다
  return EAR_Y - 2; // 나머지는 귀 위에서 끝나 구레나룻처럼 보인다
}

/** 헤어라인 y — 이마를 얼마나 덮는지. 올림머리·포니테일은 이마를 시원하게 낸다. */
function hairLine(style: number): number {
  return style === 5 || style === 6 || style === 9 ? BROW_Y - 6 : BROW_Y - 2;
}

/** 뒷머리 — 정수리부터 기장 끝까지 이어진 한 덩어리. 묶은 머리도 여기서 그린다. */
function BackHair({ s, face }: { s: AvatarSpec; face: Face }) {
  if (s.hairStyle === 7) return null; // 대머리
  const x = face.x - HAIR_PAD;
  const w = face.w + HAIR_PAD * 2;
  const y = face.y - HAIR_PAD;
  const bottom = hairLength(s.hairStyle, face);

  return (
    <g>
      {/* 포니테일 — 얼굴 뒤에 둔다. 옆에 붙이면 볼과 귀를 덮어 혹처럼 보인다 */}
      {s.hairStyle === 6 && (
        <g fill={s.hair}>
          <ellipse cx={x + w - 2} cy={EAR_Y + 14} rx="8.5" ry="14" />
          <circle cx={x + w - 4} cy={EAR_Y + 1} r="5.5" />
        </g>
      )}
      {/* 롱 계열 — 어깨 위로 흘러내리는 폭을 넓힌다 */}
      {(s.hairStyle === 2 || s.hairStyle === 10) && (
        <path
          d={`M${x + 1} ${EAR_Y} Q${x - 5} ${bottom - 20} ${x - 3} ${bottom} L${x + w + 3} ${bottom} Q${x + w + 5} ${bottom - 20} ${x + w - 1} ${EAR_Y} Z`}
          fill={s.hair}
        />
      )}

      {/* 롱웨이브 — 밑단을 물결로. 직선으로 끊으면 가발처럼 보인다 */}
      {s.hairStyle === 8 && (
        <path
          d={`M${x + 1} ${EAR_Y} Q${x - 7} ${bottom - 24} ${x - 4} ${bottom - 12}
             Q${x + 2} ${bottom - 4} ${x + 8} ${bottom - 12}
             Q${x + 14} ${bottom - 3} ${x + 21} ${bottom - 12}
             Q${x + 28} ${bottom - 3} ${x + 34} ${bottom - 12}
             Q${x + 40} ${bottom - 4} ${x + w + 4} ${bottom - 12}
             Q${x + w + 7} ${bottom - 24} ${x + w - 1} ${EAR_Y} Z`}
          fill={s.hair}
        />
      )}

      {/* 양갈래 — 좌우 대칭으로 낮게 묶는다. 한쪽만 있으면 혹처럼 보인다 */}
      {s.hairStyle === 9 && (
        <g fill={s.hair}>
          <ellipse cx={x - 3} cy={EAR_Y + 20} rx="7.5" ry="13" />
          <ellipse cx={x + w + 3} cy={EAR_Y + 20} rx="7.5" ry="13" />
          <circle cx={x + 1} cy={EAR_Y + 4} r="5" />
          <circle cx={x + w - 1} cy={EAR_Y + 4} r="5" />
        </g>
      )}
      <rect x={x} y={y} width={w} height={bottom - y} rx={face.rx + HAIR_PAD} fill={s.hair} />
    </g>
  );
}

/**
 * 앞머리 — 얼굴 위에 얹혀 이마를 덮는다. 뒷머리와 같은 사각형에서 파생시켜 폭이 맞물린다.
 * 헤어라인은 직선이 아니라 가운데가 내려온 곡선이다 — 직선으로만 자르면 가발처럼 보인다.
 */
function FrontHair({ s, face, gid }: { s: AvatarSpec; face: Face; gid: string }) {
  if (s.hairStyle === 7) return null;
  const x = face.x - HAIR_PAD;
  const w = face.w + HAIR_PAD * 2;
  const y = face.y - HAIR_PAD;
  const line = hairLine(s.hairStyle);
  const parted = [2, 6, 8, 10].includes(s.hairStyle); // 가르마를 타는 스타일

  const fringe = parted
    ? // 한쪽으로 넘긴 가르마 — 반대쪽 이마가 더 드러난다
      `M${x} ${y} H${x + w} V${line - 3} Q${face.cx + 7} ${line + 7} ${x} ${line + 1} Z`
    : // 앞머리 — 가운데가 살짝 내려온다
      `M${x} ${y} H${x + w} V${line - 1} Q${face.cx} ${line + 5} ${x} ${line - 1} Z`;

  return (
    <g>
      <g clipPath={`url(#${gid}-hair)`}>
        <path d={fringe} fill={s.hair} />
        {/* 하이라이트 — 왼쪽 위에 밝은 톤 한 겹. 평면이라도 입체감이 생긴다 */}
        <path
          d={`M${x + 5} ${y + 3} Q${x + 3} ${line - 8} ${x + 8} ${line - 2} Q${x + 13} ${line - 9} ${x + 14} ${y + 2} Z`}
          fill={tint(s.hair, 0.22)}
        />
      </g>

      {/* 곱슬 — 윤곽을 울퉁불퉁하게 */}
      {s.hairStyle === 3 &&
        [0, 1, 2, 3].map((i) => (
          <circle key={i} cx={x + 5 + (i * (w - 10)) / 3} cy={y + 2} r="7.5" fill={s.hair} />
        ))}

      {/* 아프로 퍼프 — 큰 덩어리 3개 */}
      {s.hairStyle === 4 && (
        <g fill={s.hair}>
          <circle cx={x + 2} cy={y + 2} r="11" />
          <circle cx={x + w - 2} cy={y + 2} r="11" />
          <circle cx={face.cx} cy={y - 6} r="10.5" />
        </g>
      )}

      {/* 긴생머리(앞으로 흘림) — 어깨 앞으로 두 가닥. 뒤로만 넘기면 밋밋하다 */}
      {s.hairStyle === 10 && (
        <g fill={s.hair}>
          <path d={`M${x + 1} ${EAR_Y - 4} Q${x - 1} ${EAR_Y + 26} ${x + 6} ${102} L${x + 13} ${102} Q${x + 9} ${EAR_Y + 22} ${x + 8} ${EAR_Y - 4} Z`} />
          <path d={`M${x + w - 1} ${EAR_Y - 4} Q${x + w + 1} ${EAR_Y + 26} ${x + w - 6} ${102} L${x + w - 13} ${102} Q${x + w - 9} ${EAR_Y + 22} ${x + w - 8} ${EAR_Y - 4} Z`} />
        </g>
      )}

      {/* 올림머리 — 정수리 번 + 묶은 자리 */}
      {s.hairStyle === 5 && (
        <g fill={s.hair}>
          <circle cx={face.cx} cy={y - 4} r="9" />
          <rect x={face.cx - 5} y={y - 0.5} width="10" height="3.4" rx="1.7" fill={shade(s.hair, 0.8)} />
        </g>
      )}
    </g>
  );
}

// ── 눈썹 ──────────────────────────────────────────────────────────────────────
// 0 자연 · 1 일자 · 2 아치 · 3 두꺼운
// 막대가 아니라 안쪽이 두껍고 바깥이 가늘어지는 형태다 — 이 차이가 표정을 만든다.
function Brows({ s }: { s: AvatarSpec }) {
  const th = s.brow === 3 ? 3.6 : 2.6;
  const w = 11;
  const color = shade(s.hair, 0.92);
  return (
    <g fill={color}>
      {[-1, 1].map((dir) => {
        const inner = 50 + dir * (EYE_DX - w / 2);
        const outer = 50 + dir * (EYE_DX + w / 2);
        const lift = s.brow === 2 ? 3.6 : s.brow === 1 ? 0 : 1.8;
        const outerY = s.brow === 0 ? BROW_Y + 1 : BROW_Y;
        return (
          <path
            key={dir}
            d={`M${inner} ${BROW_Y + th} Q${50 + dir * EYE_DX} ${BROW_Y - lift} ${outer} ${outerY + th * 0.55} L${outer} ${outerY + th * 0.55 + th * 0.5} Q${50 + dir * EYE_DX} ${BROW_Y - lift + th} ${inner} ${BROW_Y + th * 2} Z`}
          />
        );
      })}
    </g>
  );
}

// ── 눈 ────────────────────────────────────────────────────────────────────────
// 0 기본 · 1 웃는눈 · 2 큰눈 · 3 처진눈 · 4 놀란눈 · 5 윙크
function Eyes({ s }: { s: AvatarSpec }) {
  const closed = (ex: number, ey: number) => (
    <path
      d={`M${ex - 5} ${ey + 1.6} Q${ex} ${ey - 4.6} ${ex + 5} ${ey + 1.6}`}
      fill="none"
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
    />
  );

  if (s.eyes === 1) {
    return (
      <g>
        {closed(50 - EYE_DX, EYE_Y)}
        {closed(50 + EYE_DX, EYE_Y)}
      </g>
    );
  }

  const big = s.eyes === 2 || s.eyes === 4;
  const rx = big ? 5.6 : 4.9;
  const ry = s.eyes === 4 ? 6.6 : big ? 6 : 5.3;
  const droop = s.eyes === 3 ? 1.2 : 0;

  return (
    <g>
      {[-1, 1].map((dir) => {
        const ex = 50 + dir * EYE_DX;
        const ey = EYE_Y + droop;
        if (s.eyes === 5 && dir === 1) return <g key={dir}>{closed(ex, ey)}</g>;
        return (
          <g key={dir}>
            <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill="#ffffff" />
            <ellipse cx={ex} cy={ey + 0.5} rx={rx * 0.66} ry={ry * 0.66} fill={s.eyeColor} />
            <ellipse cx={ex} cy={ey + 0.7} rx={rx * 0.32} ry={ry * 0.32} fill={INK} />
            {/* 하이라이트 — 이게 없으면 눈이 죽는다 */}
            <circle cx={ex - rx * 0.3} cy={ey - ry * 0.36} r={rx * 0.22} fill="#ffffff" />
            {/* 윗눈꺼풀 — 흰자 위를 살짝 덮어야 인형 눈이 안 된다 */}
            <path
              d={`M${ex - rx - 0.4} ${ey - ry * 0.5} Q${ex} ${ey - ry - 1.8} ${ex + rx + 0.4} ${ey - ry * 0.5}`}
              fill="none"
              stroke={INK}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </g>
  );
}

// ── 코 ────────────────────────────────────────────────────────────────────────
// 0 없음 · 1 버튼코 · 2 동그란 · 3 뾰족 · 4 납작 · 5 주먹코
// 평면 스타일이라 코는 '살색보다 조금 어두운 한 겹'으로만 표현한다.
// 외곽선을 넣으면 이목구비 중 코만 튀어 인상이 무너진다.
function Nose({ s }: { s: AvatarSpec }) {
  if (s.nose === 0) return null;
  const c = shade(s.skin, 0.78);

  if (s.nose === 2) {
    return <ellipse cx="50" cy={NOSE_Y + 0.6} rx="2.4" ry="2.2" fill={c} />;
  }
  if (s.nose === 3) {
    // 뾰족 — 콧등에서 코끝으로 내려오는 삼각형
    return (
      <path
        d={`M50 ${NOSE_Y - 4.4} L${50 + 2.6} ${NOSE_Y + 1.8} L${50 - 2.6} ${NOSE_Y + 1.8} Z`}
        fill={c}
      />
    );
  }
  if (s.nose === 4) {
    // 납작 — 가로로 넓고 낮게
    return <rect x={50 - 4.2} y={NOSE_Y - 0.4} width="8.4" height="2.2" rx="1.1" fill={c} />;
  }
  if (s.nose === 5) {
    // 주먹코 — 콧방울까지 보이게 세 덩어리
    return (
      <g fill={c}>
        <ellipse cx="50" cy={NOSE_Y + 0.4} rx="3.4" ry="3" />
        <circle cx={50 - 3.4} cy={NOSE_Y + 1.4} r="1.7" />
        <circle cx={50 + 3.4} cy={NOSE_Y + 1.4} r="1.7" />
      </g>
    );
  }
  // 버튼코 — 아래로 볼록한 짧은 호(기본값)
  return (
    <path
      d={`M${50 - 2.8} ${NOSE_Y} Q50 ${NOSE_Y + 3.2} ${50 + 2.8} ${NOSE_Y}`}
      fill="none"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  );
}

// ── 입 ────────────────────────────────────────────────────────────────────────
// 0 미소 · 1 활짝 · 2 오물 · 3 무표정 · 4 씩
function Mouth({ s }: { s: AvatarSpec }) {
  const lip = '#c9455c';
  if (s.mouth === 1) {
    // 활짝 — 입안과 혀까지 넣어야 웃는 게 보인다
    return (
      <g>
        <path d={`M${50 - 6.4} ${MOUTH_Y - 1} Q50 ${MOUTH_Y + 7.6} ${50 + 6.4} ${MOUTH_Y - 1} Z`} fill={INK} />
        <path d={`M${50 - 4.6} ${MOUTH_Y + 2.6} Q50 ${MOUTH_Y + 7} ${50 + 4.6} ${MOUTH_Y + 2.6} Z`} fill={lip} />
      </g>
    );
  }
  if (s.mouth === 2) {
    return (
      <g>
        <ellipse cx="50" cy={MOUTH_Y + 1} rx="2.8" ry="3.2" fill={INK} />
        <ellipse cx="50" cy={MOUTH_Y + 2} rx="1.6" ry="1.6" fill={lip} />
      </g>
    );
  }
  if (s.mouth === 3) {
    return <rect x={50 - 5} y={MOUTH_Y} width="10" height="2.6" rx="1.3" fill={lip} />;
  }
  if (s.mouth === 4) {
    return (
      <path
        d={`M${50 - 6} ${MOUTH_Y} Q${50 - 1} ${MOUTH_Y + 4.4} ${50 + 6} ${MOUTH_Y - 1.8}`}
        fill="none"
        stroke={lip}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    );
  }
  return (
    <path
      d={`M${50 - 5.4} ${MOUTH_Y} Q50 ${MOUTH_Y + 5} ${50 + 5.4} ${MOUTH_Y}`}
      fill="none"
      stroke={lip}
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  );
}

// ── 수염 ──────────────────────────────────────────────────────────────────────
// 0 없음 · 1 콧수염 · 2 턱수염 · 3 풀비어드 · 4 염소수염
// 5 일자 콧수염 · 6 카이저 콧수염 · 7 얇은 콧수염 — 콧수염만 있는 종류
function Beard({ s, face, gid }: { s: AvatarSpec; face: Face; gid: string }) {
  if (s.beard === 0) return null;
  const c = s.hair;
  const stache = `M${50 - 9} ${MOUTH_Y - 5} Q50 ${MOUTH_Y - 9} ${50 + 9} ${MOUTH_Y - 5} Q${50 + 4.5} ${MOUTH_Y - 1} 50 ${MOUTH_Y - 3} Q${50 - 4.5} ${MOUTH_Y - 1} ${50 - 9} ${MOUTH_Y - 5} Z`;

  if (s.beard === 1) return <path d={stache} fill={c} />;

  // 일자 — 두껍고 각지게. 끝이 살짝 처져야 얹어놓은 막대처럼 보이지 않는다
  if (s.beard === 5) {
    return (
      <path
        d={`M${50 - 10.5} ${MOUTH_Y - 7.4} L50 ${MOUTH_Y - 4.6} L${50 + 10.5} ${MOUTH_Y - 7.4} L${50 + 10.5} ${MOUTH_Y - 3.4} L50 ${MOUTH_Y - 1} L${50 - 10.5} ${MOUTH_Y - 3.4} Z`}
        fill={c}
      />
    );
  }

  // 카이저 — 양끝이 위로 말린다. 말린 끝이 얼굴 밖으로 나가지 않게 폭을 잡았다
  if (s.beard === 6) {
    return (
      <path
        d={`M${50 - 8} ${MOUTH_Y - 4.6} Q50 ${MOUTH_Y - 8.6} ${50 + 8} ${MOUTH_Y - 4.6}
           Q${50 + 11.5} ${MOUTH_Y - 5.4} ${50 + 11.8} ${MOUTH_Y - 9.6}
           Q${50 + 13.6} ${MOUTH_Y - 5} ${50 + 9} ${MOUTH_Y - 2.4}
           Q50 ${MOUTH_Y - 5.2} ${50 - 9} ${MOUTH_Y - 2.4}
           Q${50 - 13.6} ${MOUTH_Y - 5} ${50 - 11.8} ${MOUTH_Y - 9.6}
           Q${50 - 11.5} ${MOUTH_Y - 5.4} ${50 - 8} ${MOUTH_Y - 4.6} Z`}
        fill={c}
      />
    );
  }

  // 얇은 — 선에 가깝게. 40px 로 줄면 사라지므로 최소 두께를 지킨다
  if (s.beard === 7) {
    return (
      <path
        d={`M${50 - 8} ${MOUTH_Y - 4.4} Q50 ${MOUTH_Y - 7.6} ${50 + 8} ${MOUTH_Y - 4.4} Q50 ${MOUTH_Y - 5.4} ${50 - 8} ${MOUTH_Y - 4.4} Z`}
        fill={c}
      />
    );
  }

  if (s.beard === 4) {
    return (
      <g fill={c}>
        <path d={stache} />
        <path
          d={`M${50 - 4.4} ${MOUTH_Y + 4} Q50 ${MOUTH_Y + 3} ${50 + 4.4} ${MOUTH_Y + 4} Q${50 + 3} ${MOUTH_Y + 11} 50 ${MOUTH_Y + 11} Q${50 - 3} ${MOUTH_Y + 11} ${50 - 4.4} ${MOUTH_Y + 4} Z`}
        />
      </g>
    );
  }
  if (s.beard === 2) {
    return (
      <g clipPath={`url(#${gid}-face)`}>
        <path
          d={`M${face.x + 5} ${MOUTH_Y + 2} Q50 ${face.bottom + 4} ${face.x + face.w - 5} ${MOUTH_Y + 2} L${face.x + face.w - 5} ${face.bottom} L${face.x + 5} ${face.bottom} Z`}
          fill={c}
        />
      </g>
    );
  }
  // 풀비어드 — 턱을 감싸고 구레나룻까지 올라간다
  return (
    <g clipPath={`url(#${gid}-face)`}>
      <path
        d={`M${face.x} ${EAR_Y - 2} L${face.x + 7} ${EAR_Y - 2} Q${face.x + 8} ${MOUTH_Y + 1} 50 ${MOUTH_Y + 2} Q${face.x + face.w - 8} ${MOUTH_Y + 1} ${face.x + face.w - 7} ${EAR_Y - 2} L${face.x + face.w} ${EAR_Y - 2} L${face.x + face.w} ${face.bottom} L${face.x} ${face.bottom} Z`}
        fill={c}
      />
      <path d={stache} fill={c} />
    </g>
  );
}

// ── 안경 ──────────────────────────────────────────────────────────────────────
// 0 없음 · 1 사각뿔테 · 2 둥근테 · 3 선글라스 · 4 반무테
function Glasses({ s }: { s: AvatarSpec }) {
  if (s.glasses === 0) return null;
  const frame = '#2f5fa8';
  const w = 14.4;
  const h = 11.6;
  const y = EYE_Y - h / 2;
  const lx = 50 - EYE_DX - w / 2;
  const rx2 = 50 + EYE_DX - w / 2;
  // 안경다리 — 귀까지 이어져야 걸쳐 있는 것으로 보인다
  const temples = (
    <>
      <path d={`M${lx} ${EYE_Y - 2} L${lx - 5} ${EAR_Y - 2}`} stroke={frame} strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M${rx2 + w} ${EYE_Y - 2} L${rx2 + w + 5} ${EAR_Y - 2}`} stroke={frame} strokeWidth="2.2" strokeLinecap="round" />
    </>
  );

  if (s.glasses === 2) {
    return (
      <g fill="none" stroke={frame} strokeWidth="2.4">
        <circle cx={50 - EYE_DX} cy={EYE_Y} r="7" />
        <circle cx={50 + EYE_DX} cy={EYE_Y} r="7" />
        <path d={`M${50 - EYE_DX + 7} ${EYE_Y} L${50 + EYE_DX - 7} ${EYE_Y}`} />
        {temples}
      </g>
    );
  }
  if (s.glasses === 4) {
    return (
      <g fill="none" stroke={frame} strokeWidth="2.4" strokeLinecap="round">
        <path d={`M${lx} ${y + 2} L${lx + w} ${y + 2} L${lx + w - 2} ${y + h} L${lx + 2} ${y + h} Z`} />
        <path d={`M${rx2} ${y + 2} L${rx2 + w} ${y + 2} L${rx2 + w - 2} ${y + h} L${rx2 + 2} ${y + h} Z`} />
        <path d={`M${lx + w} ${y + 3} L${rx2} ${y + 3}`} />
        {temples}
      </g>
    );
  }
  const dark = s.glasses === 3;
  return (
    <g fill="none" stroke={frame} strokeWidth="2.6">
      <rect x={lx} y={y} width={w} height={h} rx="3.2" fill={dark ? '#4a4f5c' : 'none'} />
      <rect x={rx2} y={y} width={w} height={h} rx="3.2" fill={dark ? '#4a4f5c' : 'none'} />
      <path d={`M${lx + w} ${EYE_Y - 1.5} L${rx2} ${EYE_Y - 1.5}`} />
      {temples}
    </g>
  );
}
