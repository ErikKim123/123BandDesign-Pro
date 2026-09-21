// 회원활동 §3 — 아바타 통계. "회원들이 자기 얼굴을 실제로 꾸미고 있는가"와
// 어떤 선택지가 쓰이는지(팔레트를 더 늘릴지 판단할 근거)를 본다.
//
// 왜 브라우저에서 세는가: 특성은 회원이 고른 값 + 시드에서 파생된 값이 섞여 있고,
// 그 파생 규칙이 lib/avatar.ts(TS)에 있다. DB 는 avatar_traits 의 '고른 항목'만 알 뿐
// 실제로 어떤 얼굴이 나오는지 모른다 → 시드/특성만 받아 여기서 avatarSpec() 을 돌린다.
'use client';
import { useMemo } from 'react';
import { tr } from '@/i18n/tr';
import { fmt } from '@/i18n/dict';
import { CharacterAvatar } from '@/components/member/CharacterAvatar';
import { avatarSpec, parseTraits } from '@/lib/avatar';
import { useAvatarPopulation } from '@/lib/queries/member-activity';
import {
  COLOR_TRAITS,
  COLOR_TRAIT_KEYS,
  SHAPE_TRAITS,
  SHAPE_TRAIT_KEYS,
  type ColorTraitKey,
  type ShapeTraitKey,
} from './avatar-traits';

interface Bucket {
  index: number;
  label: string;
  count: number;
  /** 이 선택지가 실제로 어떤 얼굴인지 보여줄 표본(맨 처음 만난 회원) */
  sampleSeed: string | null;
  sampleTraits: unknown;
  /** 색 항목일 때만 — 견본 색 */
  color?: string;
}

function Bar({ b, total }: { b: Bucket; total: number }) {
  const pct = total > 0 ? (b.count / total) * 100 : 0;
  return (
    <li className="flex items-center gap-2.5">
      {b.color ? (
        <span
          className="size-7 shrink-0 rounded-full border border-grey-200"
          style={{ backgroundColor: b.color }}
        />
      ) : (
        <CharacterAvatar
          seed={b.sampleSeed}
          traits={b.sampleTraits}
          size={28}
          className="shrink-0 rounded-full border border-grey-200"
        />
      )}
      <span className="w-20 shrink-0 truncate text-xs text-grey-600">{tr(b.label)}</span>
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-pill bg-grey-100">
        <span className="block h-full rounded-pill bg-black" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-grey-500">
        {b.count} · {pct.toFixed(0)}%
      </span>
    </li>
  );
}

function TraitBlock({ title, buckets, total }: { title: string; buckets: Bucket[]; total: number }) {
  return (
    <section className="rounded-lg border border-grey-200 p-4">
      <h3 className="label-caps mb-3">{tr(title)}</h3>
      <ul className="space-y-2">
        {buckets.map((b) => (
          <Bar key={`${title}-${b.index}`} b={b} total={total} />
        ))}
      </ul>
    </section>
  );
}

export function AvatarStatsPanel() {
  const { data: members = [], isLoading } = useAvatarPopulation();

  const stats = useMemo(() => {
    const shape = {} as Record<ShapeTraitKey, Bucket[]>;
    for (const k of SHAPE_TRAIT_KEYS) {
      // union 타입의 readonly 튜플이라 그대로는 map 시그니처가 안 맞는다 — 공통 형태로 넓혀 준다.
      shape[k] = (SHAPE_TRAITS[k].options as readonly string[]).map((label, index) => ({
        index,
        label,
        count: 0,
        sampleSeed: null,
        sampleTraits: null,
      }));
    }
    const color = {} as Record<ColorTraitKey, Bucket[]>;
    for (const k of COLOR_TRAIT_KEYS) {
      color[k] = (COLOR_TRAITS[k].palette as readonly string[]).map((hex, index) => ({
        index,
        label: `#${index + 1}`,
        count: 0,
        sampleSeed: null,
        sampleTraits: null,
        color: hex,
      }));
    }

    let customized = 0;
    for (const m of members) {
      if (m.avatar_customized) customized += 1;
      const spec = avatarSpec(m.avatar_seed, parseTraits(m.avatar_traits));

      for (const k of SHAPE_TRAIT_KEYS) {
        const b = shape[k][spec[k]];
        if (!b) continue; // 팔레트가 줄어든 뒤의 옛 값 — 통계에서만 조용히 건너뛴다
        b.count += 1;
        if (!b.sampleSeed) {
          b.sampleSeed = m.avatar_seed;
          b.sampleTraits = m.avatar_traits;
        }
      }
      for (const k of COLOR_TRAIT_KEYS) {
        const idx = (COLOR_TRAITS[k].palette as readonly string[]).indexOf(spec[k]);
        const b = idx >= 0 ? color[k][idx] : undefined;
        if (b) b.count += 1;
      }
    }

    return { shape, color, customized, total: members.length };
  }, [members]);

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-grey-500">{tr('불러오는 중…')}</p>;
  }
  if (stats.total === 0) {
    return (
      <p className="rounded-lg border border-grey-200 py-10 text-center text-sm text-grey-500">
        {tr('집계할 회원이 없습니다.')}
      </p>
    );
  }

  const customPct = (stats.customized / stats.total) * 100;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          { label: '집계 대상 회원', value: stats.total.toLocaleString() },
          { label: '직접 꾸민 회원', value: `${stats.customized.toLocaleString()} (${customPct.toFixed(0)}%)` },
          {
            label: '기본 얼굴 그대로',
            value: `${(stats.total - stats.customized).toLocaleString()} (${(100 - customPct).toFixed(0)}%)`,
          },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-grey-200 p-4">
            <span className="label-caps">{tr(c.label)}</span>
            <p className="mt-1 font-display text-2xl tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-grey-600">
        {fmt(
          tr(
            '가입 시에는 시드로 얼굴이 자동 결정되고, 회원이 편집기에서 고른 항목만 저장됩니다. 아래 분포는 "실제로 화면에 그려지는 얼굴" 기준(고른 값 + 시드 파생값)이며, 최근 가입 {n}명까지 집계합니다.',
          ),
          { n: stats.total.toLocaleString() },
        )}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {SHAPE_TRAIT_KEYS.map((k) => (
          <TraitBlock key={k} title={SHAPE_TRAITS[k].label} buckets={stats.shape[k]} total={stats.total} />
        ))}
        {COLOR_TRAIT_KEYS.map((k) => (
          <TraitBlock key={k} title={COLOR_TRAITS[k].label} buckets={stats.color[k]} total={stats.total} />
        ))}
      </div>
    </div>
  );
}
