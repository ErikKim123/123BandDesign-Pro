// Design Ref: Wolf Design System (tokens/*) — 선셋 테마(오렌지·크림·잉크) 토큰 이식.
// grey-*/black 등 기존 클래스명은 유지하되 값만 123Band 잉크 램프로 리맵해 비파괴 전환.
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── 123Band 브랜드 (선셋) ──
        primary: '#fa520f', // 123Band orange — primary CTA / active / link
        'primary-deep': '#cc3a05', // pressed
        'primary-foreground': '#ffffff',

        sunshine: {
          300: '#ffd06a',
          500: '#ffb83e',
          700: '#ffa110',
          800: '#ff8105',
          900: '#ff8a00',
        },
        'yellow-saturated': '#ffd900',

        // 크림 / 따뜻한 표면
        cream: {
          DEFAULT: '#fff8e0',
          light: '#fffaeb',
          deeper: '#fff0c2',
        },
        beige: '#e6d5a8', // cream 표면 위 1px 보더

        // 잉크 램프 (텍스트)
        ink: {
          DEFAULT: '#1f1f1f',
          tint: '#3d3d3d',
        },
        black: '#1f1f1f', // back-compat 별칭 → 잉크
        white: '#ffffff',

        // 중립 램프 — 키(grey-*) 보존, 값만 123Band 잉크/헤어라인으로 워밍
        grey: {
          50: '#fafafa',
          100: '#f3f3f3',
          200: '#ededed', // hairline-soft
          300: '#c7c7c7', // hairline-strong / input border
          400: '#a8a8a8', // muted
          500: '#6a6a6a', // steel — secondary text
          600: '#4a4a4a', // slate
          700: '#3d3d3d', // ink-tint
          800: '#2c2c2c', // charcoal
          900: '#1f1f1f', // ink
        },

        // 시맨틱 / shadcn 류 별칭
        success: '#1eaa52',
        danger: '#d30005',
        destructive: '#d30005',
        info: '#1151ff',
        live: '#fa520f', // 'live' → 브랜드 오렌지
        background: '#ffffff',
        foreground: '#1f1f1f',
        muted: '#f3f3f3',
        'muted-foreground': '#6a6a6a',
        border: '#ededed',
      },
      fontFamily: {
        // 디스플레이(헤딩) — Pretendard(next/font 변수). 가독성 우선: serif 대신 굵기로 위계.
        display: [
          'var(--font-pretendard)',
          '"Pretendard Variable"',
          'Pretendard',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          'sans-serif',
        ],
        // UI/본문 — Pretendard (KR+Latin, next/font 변수)
        sans: [
          'var(--font-pretendard)',
          '"Pretendard Variable"',
          'Pretendard',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px', // 버튼, 인풋, 코드블록
        lg: '12px', // 카드 (지배적)
        xl: '16px', // 큰 피처 패널
        '2xl': '20px', // 강조 카드
        pill: '9999px', // 배지 전용 (버튼 X)
      },
      boxShadow: {
        divider: '0px -1px 0px 0px #ededed inset',
        focus: '0 0 0 2px rgba(250, 82, 15, 0.45)', // 오렌지 focus
        1: 'rgba(0,0,0,0.04) 0px 1px 2px 0px',
        2: 'rgba(0,0,0,0.04) 0px 4px 12px 0px',
        3: 'rgba(0,0,0,0.08) 0px 12px 24px -4px',
        4: 'rgba(0,0,0,0.12) 0px 16px 48px -8px',
      },
      backgroundImage: {
        // 시그니처 sunset stripe (오렌지 → 옐로 → 크림)
        'sunset-stripe':
          'linear-gradient(90deg, #fa520f 0%, #ff8105 28%, #ffa110 50%, #ffd900 78%, #fff8e0 100%)',
        // 히어로 대기 그라데이션 sky
        'sunset-sky':
          'linear-gradient(180deg, #ff8a00 0%, #ffa110 32%, #ffb83e 58%, #ffd06a 80%, #fff8e0 100%)',
      },
      transitionTimingFunction: {
        jnj: 'cubic-bezier(0.4, 0, 0.2, 1)', // back-compat 별칭
        wolf: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
