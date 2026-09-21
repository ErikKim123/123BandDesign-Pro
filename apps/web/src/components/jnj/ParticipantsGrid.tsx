// Design Ref: J&J 전체 참여자 — 대회에 나온 사람 전원의 카드 그리드(시상대에 못 오른 사람도 남는다).
// 참고 레퍼런스(Bachata Social World Cup 참가자 페이지)의 카드 문법을 따른다:
//   세로 인물 사진 한 장 + 아래를 덮는 어두운 그라데이션 + 이름 · 국기 · 국가, 우측 하단에 인스타 링크.
// 사진 톤이 제각각(스튜디오 컷·셀카·야외)이라 어두운 오버레이가 있어야 글자가 항상 읽힌다.
import Image from 'next/image';
import { type Locale } from '@123band/shared';
import { Instagram } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { JnjParticipant } from '@/lib/queries/jnj';
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

function ParticipantCard({ p, locale }: { p: JnjParticipant; locale: Locale }) {
  const region = countryName(p.country, locale);
  const ig = instagramUrl(p.instagram);
  const no = (p.entry_no ?? '').trim();
  return (
    <figure className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-ink ring-1 ring-black/5">
      {p.photo_url ? (
        <Image
          {...storageImageProps(p.photo_url, 512)}
          alt={p.name}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-grey-800 to-ink">
          <span className="font-display text-4xl font-bold text-white/30">
            {p.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
        </div>
      )}

      {/* 참가번호 — 플로어의 배번을 그대로 옮긴 자리(왼쪽 위). 성적표·시상대가 번호로 사람을
          가리키므로, 얼굴과 번호가 여기서 한 번 이어져 있어야 그 표들을 읽을 수 있다.
          작게 두는 이유는 주인공이 얼굴이기 때문 — 반투명 먹 + 블러라 밝은 사진에서도 뜬다. */}
      {no && (
        <span className="absolute left-2 top-2 rounded-pill bg-black/45 px-1.5 py-0.5 font-display text-[10px] font-bold leading-none tabular-nums text-white/95 ring-1 ring-white/25 backdrop-blur-sm">
          {no}
        </span>
      )}

      {/* 이름이 어떤 사진 위에서도 읽히도록 아래쪽을 덮는다. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
      />

      <figcaption className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold leading-tight text-white">
            {p.name || '—'}
          </p>
          {region && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
              <CountryFlag cc={p.country} locale={locale} />
              <span className="truncate">{region}</span>
            </p>
          )}
        </div>
        {ig && (
          <a
            href={ig}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${p.name} Instagram`}
            className="shrink-0 rounded-full bg-white/15 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:bg-primary hover:text-white"
          >
            <Instagram size={15} />
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * 역할(리더/팔로워)별 묶음. 해당 역할이 없으면 통째로 빠진다.
 *
 * 리더·팔로워는 Jack & Jill 에서만 뜻이 있는 구분이다. BATTLE·DIV 는 한 사람(또는 한 팀)이
 * 그대로 겨루므로 나누지 않고 '참여자' 한 묶음으로 보여 준다.
 */
export function ParticipantsGrid({
  participants,
  locale,
  dict,
  kind = 'jnj',
}: {
  participants: JnjParticipant[];
  locale: Locale;
  dict: Dictionary;
  /** 이 부문의 종류(0110). 'jnj' 가 아니면 역할을 나누지 않는다. */
  kind?: string;
}) {
  const bySort = (a: JnjParticipant, b: JnjParticipant) =>
    a.sort_order - b.sort_order || a.entry_no.localeCompare(b.entry_no);
  const groups =
    kind === 'jnj'
      ? (['leader', 'follower'] as const)
          .map((role) => ({
            role: role as string,
            label: role === 'leader' ? dict.jnj.leaders : dict.jnj.followers,
            rows: participants.filter((p) => p.role === role).sort(bySort),
          }))
          .filter((g) => g.rows.length > 0)
      : [{ role: 'all', label: dict.jnj.participants, rows: [...participants].sort(bySort) }].filter(
          (g) => g.rows.length > 0,
        );

  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <section key={g.role}>
          <p className="mb-4 flex items-center gap-3 label-caps !text-[11px] !tracking-[2px] text-grey-500">
            {g.label}
            <span className="rounded-pill bg-cream-deeper px-2 py-0.5 text-[11px] font-semibold text-grey-600">
              {g.rows.length}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
            {g.rows.map((p) => (
              <ParticipantCard key={p.id} p={p} locale={locale} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
