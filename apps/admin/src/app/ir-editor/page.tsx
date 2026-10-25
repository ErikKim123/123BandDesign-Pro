// 123IR 에디터 (라이선스 없는 자체 구현) — 로그인 없이 공개 (middleware matcher 제외), 전체 화면.
import { IrStudioLoader } from '@/components/ir-editor/IrStudioLoader';

export const metadata = { title: '123IR Editor' };

export default function IrEditorPage() {
  return <IrStudioLoader />;
}
