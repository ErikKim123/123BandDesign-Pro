// Design Ref: §5.3 — 제네릭 링크 목록 필드 (FieldKind 'links').
// URL 을 여러 개(기본 최대 3개) 받아 text[] 로 저장한다. J&J 대회의 관련 영상 링크가 첫 사용처.
// 입력한 주소가 어떤 미디어인지(유튜브·비메오·동영상파일) 즉시 배지로 알려주고,
// 고객몰 플레이어가 재생하지 못하는 주소(이미지 등)는 경고 배지로 구분한다.
'use client';
import { Plus, Trash2 } from 'lucide-react';
import { isPlayableVideo, resolveMedia, MEDIA_KIND_LABEL } from '@123band/shared';
import { tr, trIn } from '@/i18n/tr';
import { useLocale, useT } from '@/lib/locale/LocaleContext';
import { cn } from '@/lib/utils';
import type { FieldDef } from '@/lib/resource/types';

const DEFAULT_MAX = 3;

export function LinkListField({
  field,
  value,
  set,
}: {
  field: FieldDef;
  value: string[] | undefined;
  set: (v: string[]) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const tl = (v: string | undefined) => trIn(v, locale);

  const max = field.maxItems ?? DEFAULT_MAX;
  // 빈 칸도 상태로 들고 있어야 '추가' 직후의 빈 입력이 사라지지 않는다. 저장 시 폼이 걸러낸다.
  const list = Array.isArray(value) ? value : [];

  const update = (i: number, url: string) => {
    const next = [...list];
    next[i] = url;
    set(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) return;
    next[i] = b;
    next[j] = a;
    set(next);
  };

  return (
    <div className="space-y-1.5">
      <label className="label-caps">
        {tl(field.label)}
        {field.required && ' *'}
      </label>
      <div className="space-y-2">
        {list.map((url, i) => {
          const trimmed = (url ?? '').trim();
          const kind = trimmed ? resolveMedia(trimmed).kind : null;
          const playable = kind ? isPlayableVideo(kind) : true;
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                className={cn('input flex-1', !playable && 'input-error')}
                value={url ?? ''}
                placeholder={tl(field.placeholder) || t.linksField.placeholder}
                onChange={(e) => update(i, e.target.value)}
              />
              {kind && (
                <span
                  className={cn(
                    'shrink-0 rounded-pill px-2 py-1 text-xs',
                    playable ? 'bg-grey-100 text-grey-600' : 'bg-danger/10 text-danger',
                  )}
                >
                  {playable ? tr(MEDIA_KIND_LABEL[kind]) : t.linksField.notPlayable}
                </span>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={i === 0}
                aria-label={t.linksField.moveUp}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={i === list.length - 1}
                aria-label={t.linksField.moveDown}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm text-danger"
                aria-label={t.linksField.remove}
                onClick={() => set(list.filter((_, j) => j !== i))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={list.length >= max}
          onClick={() => set([...list, ''])}
        >
          <Plus size={15} /> {t.linksField.add}
        </button>
        <p className="text-xs text-grey-500">
          {tl(field.hint) || t.linksField.maxHint.replace('{n}', String(max))}
          {list.length >= max && ` · ${t.linksField.maxReached}`}
        </p>
      </div>
    </div>
  );
}
