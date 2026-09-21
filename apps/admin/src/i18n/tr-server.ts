// 서버 컴포넌트용 tr() 로케일 — 요청 쿠키(admin_locale)를 읽는다.
//
// tr.ts 의 모듈 변수는 클라이언트 번들에서만 LocaleProvider 가 갱신한다. 서버 컴포넌트는 별도 모듈
// 인스턴스라 그 값을 못 보고 늘 기본값(ko)이었다. next/headers 는 클라이언트에서 못 쓰므로 여기서만
// 불러 리졸버로 넘긴다. 루트 레이아웃(서버)이 이 모듈을 한 번 import 하면 등록된다.
import { cookies } from 'next/headers';
import { isAdminLocale } from './dict';
import { setTrLocaleResolver } from './tr';

setTrLocaleResolver(() => {
  const v = cookies().get('admin_locale')?.value;
  return isAdminLocale(v) ? v : null;
});
