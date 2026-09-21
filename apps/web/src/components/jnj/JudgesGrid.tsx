// Design Ref: J&J 심사위원 소개 — 부문 탭 안의 한 섹션. 사진 카드 그리드.
// 챔피언(어두운 스테이지)과 달리 밝은 톤 카드로 두어, 시상대와 시각적으로 구분한다.
//
// 사진 프레임을 정사각으로 두는 이유: 심사위원 원본은 배경을 지운 4:5 컷아웃이고
// 위쪽에 빈 여백이 20~35% 들어 있다(인물은 항상 아래 끝에 붙어 있음).
// 4:5 를 1:1 프레임에 object-cover + 하단 정렬로 넣으면 위 20% 가 정확히 잘려 나가고
// 좌우는 한 픽셀도 안 잘린다 — 머리 위 빈 공간만 없애는 가장 안전한 크롭이다.
import Image from 'next/image';
import { Instagram } from 'lucide-react';
import { pickI18n, type Locale } from '@123band/shared';
import type { Dictionary } from '@/i18n/dictionaries';
import type { JnjJudge } from '@/lib/queries/jnj';
import { CountryFlag, countryName } from './flag';
import { storageImageProps } from '@/lib/image';

/** 핸들('@ataca')·URL 어느 쪽으로 저장돼도 인스타 주소로 만든다. 값이 이상하면 null. */
function instagramUrl(raw: string | null): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, '').replace(/\/+$/, '');
  if (!/^[A-Za-z0-9._]+$/.test(handle)) return null;
  return `https://instagram.com/${handle}`;
}

function JudgeCard({ judge, locale }: { judge: JnjJudge; locale: Locale }) {
  const role = pickI18n(judge.title_i18n, locale);
  const bio = pickI18n(judge.bio_i18n, locale);
  const region = countryName(judge.country, locale);
  const ig = instagramUrl(judge.instagram);

  return (
    <figure className="group overflow-hidden rounded-2xl border border-beige/70 bg-white transition duration-300 ease-out hover:-translate-y-0.5 hover:border-beige hover:shadow-[0_18px_40px_-24px_rgba(31,31,31,0.45)]">
      {/* 사진 — 컷아웃이 서 있는 '무대'처럼 위에서 아래로 옅어지는 크림 배경 */}
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-cream-deeper via-cream to-cream-light">
        {judge.photo_url ? (
          <Image
            {...storageImageProps(judge.photo_url, 512)}
            alt={judge.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 260px"
            className="origin-bottom object-cover object-bottom transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-4xl font-bold text-beige">
              {judge.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        )}
      </div>
      <figcaption className="px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-bold leading-tight text-ink">
              {judge.name || '—'}
            </p>
            {role && <p className="label-caps mt-1.5 !text-[10px] text-primary">{role}</p>}
            {region && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-grey-500">
                <CountryFlag cc={judge.country} locale={locale} />
                <span className="truncate">{region}</span>
              </p>
            )}
          </div>
          {ig && (
            <a
              href={ig}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram — ${judge.name}`}
              className="mt-0.5 shrink-0 rounded-full border border-beige p-1.5 text-grey-500 transition-colors hover:border-primary hover:text-primary"
            >
              <Instagram size={14} />
            </a>
          )}
        </div>
        {bio && <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-grey-600">{bio}</p>}
      </figcaption>
    </figure>
  );
}

export function JudgesGrid({
  judges,
  locale,
  dict,
}: {
  judges: JnjJudge[];
  locale: Locale;
  dict: Dictionary;
}) {
  if (judges.length === 0) {
    return (
      <div className="rounded-xl bg-white px-6 py-14 text-center">
        <p className="font-display text-lg text-ink">{dict.jnj.noJudges}</p>
        <p className="mt-2 text-sm text-grey-500">{dict.jnj.noJudgesHint}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {judges.map((j) => (
        <JudgeCard key={j.id} judge={j} locale={locale} />
      ))}
    </div>
  );
}
