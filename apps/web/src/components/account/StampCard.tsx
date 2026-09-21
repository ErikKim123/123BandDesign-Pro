// Design Ref: 마이페이지 스탬프 — 도장 카드.
// 종이 스탬프 카드의 은유를 그대로 쓴다: 칸이 goal 개 있고, 받은 만큼 도장이 찍힌다.
// 상호작용이 없으므로 서버 컴포넌트다(증감은 전부 DB 함수가 한다).
import { Stamp } from 'lucide-react';

export function StampCard({
  count,
  goal,
  title,
  desc,
  progress,
  remaining,
}: {
  /** 지금까지 찍힌 도장 수. 보상 쿠폰이 지정되기 전이면 goal 을 넘어설 수 있다. */
  count: number;
  goal: number;
  title: string;
  desc: string;
  progress: string;
  /** "N개 더 모으면…" — 카드가 이미 찼으면 null */
  remaining: string | null;
}) {
  // 칸 수가 0(정책 미설정)이면 카드를 그릴 수 없다 — 진행도 숫자만 남긴다.
  const slots = goal > 0 ? goal : 0;
  // 넘친 도장(보상 미지정으로 쌓인 분)은 카드를 꽉 찬 상태로만 표현한다.
  const filled = Math.min(count, slots);

  return (
    <section className="rounded-lg border border-primary/30 bg-cream p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-grey-600">{desc}</p>

      {slots > 0 && (
        <ul
          // 칸이 많아도 한 줄이 넘치지 않게 5칸씩 접는다(10칸 = 2줄).
          className="mx-auto mt-5 grid max-w-xs grid-cols-5 gap-2.5"
          aria-label={progress}
        >
          {Array.from({ length: slots }, (_, i) => {
            const on = i < filled;
            return (
              <li
                key={i}
                aria-hidden
                className={`flex aspect-square items-center justify-center rounded-full border-2 transition-colors ${
                  on
                    ? 'border-primary bg-primary text-white'
                    : 'border-dashed border-grey-300 text-grey-300'
                }`}
              >
                {on ? <Stamp size={18} /> : <span className="text-xs tabular-nums">{i + 1}</span>}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-5 text-3xl font-semibold tabular-nums text-primary">{progress}</p>
      {remaining && <p className="mt-1 text-sm text-grey-600">{remaining}</p>}
    </section>
  );
}
