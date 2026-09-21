// Design Ref: J&J 개요 카드의 '지금 받는 중' 목록 — 어느 부문이 무엇을 받고 있는지 보여주고,
// 누르면 그 부문으로 갈아타면서 해당 섹션까지 데려간다.
//
// 한 부문이 한 줄이다. 예전에는 마크 하나가 한 줄이라, 부문 여섯 개가 참가·심사 둘씩 열려 있으면
// 열두 줄이 되고 부문 이름이 두 번씩 적혔다. 이름이 줄마다 반복되니 눈이 이름을 읽는 대신
// 세어야 했고, 오렌지·먹색이 한 줄 걸러 번갈아 나와 줄무늬처럼 보였다.
// 이름을 왼쪽에 한 번만 두고 할 수 있는 일을 오른쪽에 모으면, 줄 수는 절반이 되고
// 왼쪽으로는 부문을, 오른쪽으로는 열려 있는 일을 각각 훑을 수 있다.
//
// 왜 Link 하나로 끝내지 않는가: 주소만 `?d=…#signup` 으로 넘기면 부문 전환은 되는데
// 해시 위치로 스크롤이 안 걸린다(앱 라우터가 섹션이 그려지기 전에 스크롤을 끝낸다).
// 데스크톱은 신청 섹션이 이미 화면 안이라 티가 안 나지만, 모바일에선 화면이 그대로라
// '눌러도 아무 일도 안 일어난다'로 보였다. 그래서 클릭을 직접 받아 섹션이 나타나면 그때 스크롤한다.
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface JnjOpenTag {
  key: string;
  /** 부문 코드 — 같은 부문의 마크를 한 줄로 묶는 기준. */
  code: string;
  /** 이동 주소 — 부문(d)과 섹션 해시까지 담겨 있다. 새로고침·공유해도 같은 자리로 온다. */
  href: string;
  /** 스크롤 대상 섹션 id ('signup' | 'vote') */
  targetId: string;
  label: string;
  tag: string;
  vote: boolean;
}

/** 섹션이 그려질 때까지(최대 3초) 기다렸다가 그 자리로 부드럽게 내린다. */
function scrollWhenReady(targetId: string) {
  const startedAt = performance.now();
  const tick = () => {
    const el = document.getElementById(targetId);
    if (el) {
      // scroll-mt-* (sticky 칩 바 높이) 를 그대로 존중한다 — 제목이 바 뒤로 숨지 않게.
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (performance.now() - startedAt < 3000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 참가 신청은 브랜드 오렌지, 관객 심사는 먹색 — 섬네일 마크와 같은 색 규칙. */
const CHIP =
  'rounded-pill border px-2 py-[3px] text-[11px] font-semibold leading-none transition-colors ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const CHIP_SIGNUP =
  'border-primary/35 bg-primary/10 text-primary-deep hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-primary';
const CHIP_VOTE =
  'border-ink/20 bg-ink/[0.06] text-ink hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-ink';

export function JnjOpenTags({ tags }: { tags: JnjOpenTag[] }) {
  const router = useRouter();
  if (tags.length === 0) return null;

  // 부문 하나가 한 줄. 순서는 받은 순서(=부문 탭 순서) 그대로 둔다 — 아래 탭과 눈이 맞는다.
  const rows: { code: string; label: string; items: JnjOpenTag[] }[] = [];
  for (const t of tags) {
    const row = rows.find((r) => r.code === t.code);
    if (row) row.items.push(t);
    else rows.push({ code: t.code, label: t.label, items: [t] });
  }

  return (
    // 데스크톱은 포스터 옆 고정 폭(포스터 높이와 비슷한 덩어리로 읽힌다), 모바일은 본문 아래 전체 폭.
    <div className="w-full shrink-0 md:w-[19rem]">
      <ul className="divide-y divide-beige overflow-hidden rounded-xl border border-beige bg-white/70">
        {rows.map((row) => (
          <li key={row.code} className="flex items-center gap-2 px-3 py-2">
            {/* 이름은 줄여서라도 한 줄에 — 두 줄로 넘어가면 오른쪽 칩과 높이가 어긋나 목록이 흐트러진다. */}
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight text-ink">
              {row.label}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {row.items.map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  // 화면에는 '참가 신청'만 보이지만, 읽어주는 기기에는 어느 부문 것인지까지 들려준다.
                  aria-label={`${row.label} · ${t.tag}`}
                  onClick={(e) => {
                    // 새 탭·창으로 여는 클릭은 브라우저에 맡긴다.
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    // 라우터의 기본 스크롤(맨 위로)을 끄고 우리가 섹션까지 내린다.
                    router.push(t.href, { scroll: false });
                    scrollWhenReady(t.targetId);
                  }}
                  className={`${CHIP} ${t.vote ? CHIP_VOTE : CHIP_SIGNUP}`}
                >
                  {t.tag}
                </Link>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
