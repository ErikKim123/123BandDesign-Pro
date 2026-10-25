'use client';
// 123IR Tool 이식 (원본: 123-ir-tool.vercel.app, CRA) — Polotno 디자인 에디터 + 한글 섹션명 + 한글 폰트 + IR 템플릿 패널.
// Polotno(konva)는 window 가 필요해 IrToolLoader 에서 ssr:false 로만 불러온다.
import { useEffect, useState } from 'react';
import '@blueprintjs/core/lib/css/blueprint.css';
import './fonts.css';
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from 'polotno';
import { Workspace } from 'polotno/canvas/workspace';
import { SidePanel, DEFAULT_SECTIONS, SectionTab } from 'polotno/side-panel';
import { Toolbar } from 'polotno/toolbar/toolbar';
import { PagesTimeline } from 'polotno/pages-timeline';
import { ZoomButtons } from 'polotno/toolbar/zoom-buttons';
import { createStore } from 'polotno/model/store';
import { TemplatesSection } from './TemplatesSection';
import { registerKoreanFonts } from './fonts';

const KOREAN_SECTION_NAMES: Record<string, string> = {
  text: '텍스트',
  elements: '요소',
  images: '이미지',
  background: '배경',
  backgrounds: '배경',
  layers: '레이어',
  filters: '필터',
  size: '크기',
  photos: '사진들',
  templates: '템플릿들',
  'custom-templates': 'IR 문서',
  upload: '업로드',
};

const koreanSections = DEFAULT_SECTIONS.map((section) => {
  const koreanName = KOREAN_SECTION_NAMES[section.name] || section.name;
  const OriginalTab = section.Tab;
  return {
    ...section,
    Tab: (props: any) =>
      OriginalTab ? <OriginalTab {...props} name={koreanName} /> : <SectionTab name={koreanName} {...props} />,
  };
});

const sections = [TemplatesSection, ...koreanSections];

function initStore() {
  const store = createStore({
    // Polotno 라이선스 키는 도메인 단위 — 배포 도메인은 polotno.com/cabinet 에 등록해야 한다.
    key: process.env.NEXT_PUBLIC_POLOTNO_KEY ?? '',
    showCredit: true,
  });
  registerKoreanFonts(store);
  store.addPage();
  return store;
}

export default function IrEditor() {
  const [store] = useState(initStore);

  // Blueprint 팝오버는 body 포털로 뜨므로 다크 테마 클래스를 body 에 건다 (원본 index.html 과 동일). 떠날 때 원복.
  useEffect(() => {
    document.body.classList.add('bp5-dark');
    return () => document.body.classList.remove('bp5-dark');
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PolotnoContainer>
        <SidePanelWrap>
          <SidePanel store={store} sections={sections} defaultSection="custom-templates" />
        </SidePanelWrap>
        <WorkspaceWrap>
          <Toolbar store={store} downloadButtonEnabled />
          <Workspace store={store} />
          <ZoomButtons store={store} />
          <PagesTimeline store={store} />
        </WorkspaceWrap>
      </PolotnoContainer>
    </div>
  );
}
