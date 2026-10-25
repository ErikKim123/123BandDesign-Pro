// 123IR Tool — IR 문서 디자인 에디터. 원본처럼 로그인 없이 공개 (middleware matcher 제외), 사이드바 없이 전체 화면.
import { IrToolLoader } from '@/components/ir-tool/IrToolLoader';

export const metadata = { title: '123IR Tool' };

export default function IrToolPage() {
  return <IrToolLoader />;
}
