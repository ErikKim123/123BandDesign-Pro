// 123IR Tool 이식 — Polotno 에디터용 한글 폰트 10개 (원본 목록 그대로, 죽은 CDN 주소만 현재 주소로 교체)
import type { StoreType } from 'polotno/model/store';

export const koreanFonts = [
  {
    fontFamily: 'Pretendard',
    fonts: [
      { url: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-Regular.woff2', weight: 400 },
      { url: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2', weight: 700 },
    ],
  },
  {
    fontFamily: 'Noto Sans KR',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf', weight: 400 },
      { url: 'https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf', weight: 700 },
    ],
  },
  {
    fontFamily: 'Nanum Gothic',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/nanumgothic/v26/PN_3Rfi-oW3hYwmKDpxS7F_z_g.ttf', weight: 400 },
      { url: 'https://fonts.gstatic.com/s/nanumgothic/v26/PN_oRfi-oW3hYwmKDpxS7F_LQv37zg.ttf', weight: 700 },
    ],
  },
  {
    fontFamily: 'Nanum Myeongjo',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/nanummyeongjo/v31/9Btx3DZF0dXLMZlywRbVRNhxy1Lr.ttf', weight: 400 },
      { url: 'https://fonts.gstatic.com/s/nanummyeongjo/v31/9Bty3DZF0dXLMZlywRbVRNhxy2pXV1A0.ttf', weight: 700 },
    ],
  },
  {
    fontFamily: 'Noto Serif KR',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/notoserifkr/v32/3JnoSDn90Gmq2mr3blnHaTZXbOtLJDvui3JOncjmeM52.ttf', weight: 400 },
      { url: 'https://fonts.gstatic.com/s/notoserifkr/v32/3JnoSDn90Gmq2mr3blnHaTZXbOtLJDvui3JOncgBf852.ttf', weight: 700 },
    ],
  },
  {
    fontFamily: 'Nanum Gothic Coding',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/nanumgothiccoding/v27/8QIVdjzHisX_8vv59_xMxtPFW4IXROwsy6Q.ttf', weight: 400 },
      { url: 'https://fonts.gstatic.com/s/nanumgothiccoding/v27/8QIYdjzHisX_8vv59_xMxtPFW4IXROws8xgecsU.ttf', weight: 700 },
    ],
  },
  {
    fontFamily: 'IBM Plex Sans KR',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/ibmplexsanskr/v11/vEFK2-VJISZe3O_rc3ZVYh4aTwNO8tI.ttf', weight: 400 },
      { url: 'https://fonts.gstatic.com/s/ibmplexsanskr/v11/vEFN2-VJISZe3O_rc3ZVYh4aTwNOym6af7Y.ttf', weight: 700 },
    ],
  },
  {
    fontFamily: 'Gothic A1',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/gothica1/v18/CSR94z5ZnPydRjlCCwl6bA.ttf', weight: 400 },
      { url: 'https://fonts.gstatic.com/s/gothica1/v18/CSR44z5ZnPydRjlCCwlC0OIKSA.ttf', weight: 700 },
    ],
  },
  {
    fontFamily: 'Nanum Pen Script',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/nanumpenscript/v25/daaDSSYiLGqEal3MvdA_FOL_3FkN2z4.ttf', weight: 400 },
    ],
  },
  {
    fontFamily: 'Nanum Brush Script',
    fonts: [
      { url: 'https://fonts.gstatic.com/s/nanumbrushscript/v26/wXK2E2wfpokopxzthSqPbcR5_gVaxazyjg.ttf', weight: 400 },
    ],
  },
];

export function registerKoreanFonts(store: StoreType) {
  koreanFonts.forEach((font) => {
    try {
      store.addFont(font);
    } catch (error) {
      console.warn(`폰트 등록 실패: ${font.fontFamily}`, error);
    }
  });
}
