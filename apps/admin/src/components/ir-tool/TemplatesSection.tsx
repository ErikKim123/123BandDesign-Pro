'use client';
// 123IR Tool 이식 — 'IR 문서' 사이드 패널. public/ir-templates/page{n}.json 목록을 무한 스크롤로 읽고,
// 선택한 템플릿 JSON 을 store 에 통째로 로드한다.
import { observer } from 'mobx-react-lite';
import { useInfiniteAPI } from 'polotno/utils/use-api';
import { SectionTab } from 'polotno/side-panel';
import { ImagesGrid } from 'polotno/side-panel/images-grid';
import type { StoreType } from 'polotno/model/store';
import { Images } from 'lucide-react';

const BASE = '/ir-templates';

type TemplateItem = { json: string; preview: string };
type TemplatePage = { total_pages: number; items: TemplateItem[] };

const TemplatesPanel = observer(({ store }: { store: StoreType }) => {
  const { data, isLoading } = useInfiniteAPI({
    getAPI: ({ page }: { page: number }) => `${BASE}/page${page}.json`,
  });

  return (
    <div style={{ height: '100%' }}>
      <ImagesGrid
        shadowEnabled={false}
        images={(data as TemplatePage[] | undefined)?.flatMap((p) => p.items)}
        getPreview={(item: TemplateItem) => `${BASE}/${encodeURIComponent(item.preview)}`}
        isLoading={isLoading}
        onSelect={async (item: TemplateItem) => {
          const req = await fetch(`${BASE}/${encodeURIComponent(item.json)}`);
          store.loadJSON(await req.json());
        }}
        rowsNumber={1}
      />
    </div>
  );
});

export const TemplatesSection = {
  name: 'custom-templates',
  Tab: (props: any) => (
    <SectionTab name="IR 문서" {...props}>
      <Images size={20} />
    </SectionTab>
  ),
  Panel: TemplatesPanel,
};
