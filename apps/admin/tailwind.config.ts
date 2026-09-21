// Design tokens: JNJ SCORE 모노크롬 (백오피스 전용, self-contained — Wolf Design System 과 별개)
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 모노크롬 코어
        black: '#111111',
        white: '#FFFFFF',
        // 그레이 스케일 (JNJ)
        grey: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#CACACB',
          400: '#9E9EA0',
          500: '#707072',
          600: '#4B4B4D',
          700: '#39393B',
          800: '#28282A',
          900: '#1F1F21',
        },
        // 시맨틱 (색은 의미에만)
        success: '#007D48',
        danger: '#D30005',
        info: '#1151FF',
        live: '#FF5000',
        // 시맨틱 별칭(shadcn 관례 호환)
        background: '#FFFFFF',
        foreground: '#111111',
        muted: '#F5F5F5',
        'muted-foreground': '#707072',
        border: '#CACACB',
        primary: '#111111',
        'primary-foreground': '#FFFFFF',
        destructive: '#D30005',
      },
      fontFamily: {
        display: ['Oswald', 'Helvetica Neue', 'Arial', 'sans-serif'],
        sans: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px', // 인풋
        lg: '20px', // 컨테이너
        xl: '24px',
        pill: '30px', // 버튼·필터 (시그니처)
      },
      boxShadow: {
        // radically flat — divider + focus만
        divider: '0px -1px 0px 0px #E5E5E5 inset',
        focus: '0 0 0 2px rgba(39, 93, 197, 1)',
      },
      transitionTimingFunction: {
        jnj: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
