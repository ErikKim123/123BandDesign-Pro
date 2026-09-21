// Design Ref: 신청 인원 숫자판 — 참가 신청·관객 심사위원 두 섹션이 같이 쓴다.
//
// 공항 출발 보드(스플릿플랩) 문법 — 숫자 한 자리씩 어두운 판에 얹는다.
//
// 왜 어울리나: 이 페이지는 아래 CHAMPION 무대가 먹색 판이라 어두운 타일이 이미 이 화면의
// 언어다. 크림색 카드 위에서 먹색 몇 칸은 눈에 확 걸리면서도 이질적이지 않다.
// 그리고 '지금 몇 명'은 계속 바뀌는 수치라, 바뀌는 숫자를 보여주는 물건(출발 보드)의
// 생김새를 빌리면 숫자가 살아 있는 값으로 읽힌다.
//
// 판마다 가운데 이음매 선과 위쪽 반쪽의 옅은 반사를 넣어 플랩이 접히는 판처럼 보이게 했다.
// 글자는 등폭(mono) — 자릿수가 늘어도 칸이 흔들리지 않고, 기계식 보드의 느낌이 산다.

/**
 * 항상 세 칸으로 채운다(010). 보드는 칸 수가 고정이라 앞자리가 0 인 채로 서 있는 게 원래
 * 모습이고, 인원이 9 → 10 으로 넘어갈 때 칸이 늘었다 줄었다 하지 않는다. 세 자리를 넘으면
 * 칸이 하나 더 붙는다.
 */
export function JnjCountBoard({ count, label }: { count: number; label: string }) {
  const digits = String(count).padStart(3, '0').split('');
  return (
    <span className="flex shrink-0 flex-col items-end gap-2.5">
      <span className="flex items-center gap-1.5" aria-hidden>
        {digits.map((d, i) => (
          <span
            key={i}
            className="relative grid h-[54px] w-10 place-items-center overflow-hidden rounded-[7px] bg-ink font-mono text-[34px] font-bold leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_14px_-6px_rgba(0,0,0,0.55)] md:h-[50px] md:w-10 md:text-[32px]"
          >
            {/* 위쪽 반쪽만 아주 옅게 밝혀 금속 반사처럼 보이게. */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/[0.07]" />
            {/* 플랩이 접히는 이음매 — 이 선 하나가 '보드'로 읽히게 만든다. */}
            <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/70" />
            <span className="relative">{d}</span>
          </span>
        ))}
      </span>
      <span className="sr-only">{count}</span>
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase leading-none tracking-[2px] text-grey-500">
        {label}
      </span>
    </span>
  );
}
