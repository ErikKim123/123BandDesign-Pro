'use client';
// 가벼운 DOM 미리보기 — 페이지 목록·템플릿 썸네일용 (캔버스를 만들지 않는다)
import { memo } from 'react';
import { figurePath } from './shapes';
import { isImageBackground, textFontStyle } from './render';
import type { El, Page } from './store';

function MiniEl({ el }: { el: El }) {
  if (el.type === 'group') {
    return (
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: el.opacity ?? 1 }}>
        {(el.children ?? []).map((c) => (c.visible === false ? null : <MiniEl key={c.id} el={c} />))}
      </div>
    );
  }
  if (el.type === 'line') {
    return (
      <div
        style={{
          position: 'absolute',
          left: el.x,
          top: el.y,
          width: el.width,
          height: 0,
          borderTop: `${el.height || 1}px ${el.dash?.length ? 'dashed' : 'solid'} ${el.color || '#000'}`,
          transform: `rotate(${el.rotation || 0}deg)`,
          transformOrigin: '0 0',
          opacity: el.opacity ?? 1,
        }}
      />
    );
  }
  const box: React.CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    transform: `rotate(${el.rotation || 0}deg)`,
    transformOrigin: '0 0',
    opacity: el.opacity ?? 1,
  };
  if (el.type === 'image') {
    const iw = el.width / (el.cropWidth || 1);
    const ih = el.height / (el.cropHeight || 1);
    return (
      <div style={{ ...box, overflow: 'hidden', borderRadius: el.cornerRadius || 0 }}>
        <img
          src={el.src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: -(el.cropX || 0) * iw,
            top: -(el.cropY || 0) * ih,
            width: iw,
            height: ih,
            maxWidth: 'none',
            transform: `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})`,
          }}
        />
      </div>
    );
  }
  if (el.type === 'figure') {
    if (el.subType === 'rect' || !el.subType)
      return <div style={{ ...box, background: el.fill, borderRadius: el.cornerRadius || 0 }} />;
    return (
      <svg style={{ ...box, overflow: 'visible' }} viewBox={`0 0 ${el.width} ${el.height}`}>
        <path d={figurePath(el.subType, el.width, el.height)} fill={el.fill} />
      </svg>
    );
  }
  const [style, weight] = textFontStyle(el).includes('italic')
    ? ['italic', textFontStyle(el).replace('italic ', '')]
    : ['normal', textFontStyle(el)];
  return (
    <div
      style={{
        ...box,
        height: 'auto',
        fontFamily: `"${el.fontFamily}", sans-serif`,
        fontSize: el.fontSize,
        fontStyle: style,
        fontWeight: weight as any,
        lineHeight: el.lineHeight || 1.2,
        color: el.fill,
        textAlign: el.align || 'left',
        whiteSpace: 'pre-wrap',
        wordBreak: 'keep-all',
        textDecoration: el.textDecoration || 'none',
        textTransform: el.textTransform === 'uppercase' || el.textTransform === 'lowercase' ? el.textTransform : 'none',
      }}
    >
      {el.text}
    </div>
  );
}

export const MiniPreview = memo(function MiniPreview({
  page,
  docWidth,
  docHeight,
  width,
}: {
  page: Page;
  docWidth: number;
  docHeight: number;
  width: number;
}) {
  const s = width / docWidth;
  const bgImg = isImageBackground(page.background);
  return (
    <div
      className="ire-mini"
      style={{
        width,
        height: docHeight * s,
        background: bgImg ? `center / cover no-repeat url("${page.background}")` : page.background || 'white',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: docWidth, height: docHeight, transform: `scale(${s})`, transformOrigin: '0 0' }}>
        {page.children.map((el) => (el.visible === false ? null : <MiniEl key={el.id} el={el} />))}
      </div>
    </div>
  );
});
