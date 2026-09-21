// Design Ref: J&J 히어로 — 잉크 배경 + 선셋 글로우. 라이트 톤 본문 위에 대회 브랜드를 세운다.
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * 참가 권유 문단(dict.jnj.invite)을 띄울지 — 지금은 끈다. 문구는 나중에 쓴다.
 *
 * 지우지 않고 스위치로 둔 이유: 켜는 순간 바로 나오게 하려고. 주석으로 묻어 두면
 * 타입 검사에서 빠져 사전 키가 바뀌어도 모르고 지나간다. 여기 두면 tsc 가 계속 지켜본다.
 * 되살릴 때는 이 값만 true 로. 문구는 ko/en.json 의 jnj.invite 에 그대로 있다.
 */
const SHOW_INVITE = false;

export function JnjHero({ dict }: { dict: Dictionary }) {
  return (
    <section className="relative overflow-hidden bg-ink">
      {/* 선셋 글로우 — 브랜드 오렌지에서 옐로로 번지는 무대 조명 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(80% 90% at 50% 110%, rgba(250,82,15,0.55) 0%, rgba(255,161,16,0.22) 40%, transparent 72%)',
        }}
      />
      <div className="container-band relative py-14 text-center md:py-20">
        <p className="label-caps !tracking-[4px] text-primary">{dict.jnj.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-white md:text-6xl">
          {dict.jnj.title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/60 md:text-base">
          {dict.jnj.intro}
        </p>
        {/* 참가 권유 — 위 문단이 '이 페이지가 무엇인가'라면 이 문단은 '그래서 나와 무슨 상관인가'다.
            intro 와 한 덩어리로 합치지 않는다: intro 는 페이지 메타 description 으로도 쓰여서
            (jnj/page.tsx) 길어지면 검색 결과에서 잘린다. 화면에서만 이어 붙인다.
            읽는 사람에게 건네는 말이라 위 설명보다 한 톤 밝게 둔다(white/60 → /75). */}
        {SHOW_INVITE && (
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/75 md:text-base">
            {dict.jnj.invite}
          </p>
        )}
      </div>
      <div className="sunset-stripe" />
    </section>
  );
}
