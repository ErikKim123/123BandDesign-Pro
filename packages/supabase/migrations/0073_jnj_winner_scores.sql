-- 0073: J&J 우승자 점수 + 전체 순위.
-- 고객몰 /jnj 의 챔피언 카드에 점수를 같이 찍고, '전체 결과' 표(4위 이하 포함)를 만들기 위한 컬럼.
--   · entry_no    : J&J Dash 참가번호(049 처럼 앞자리 0 이 있어 text)
--   · total_score : 최종(가중) 총점 — 어드민 결승 표의 '최종(가중)' 값
--   · avg_score   : 심사위원 평균 점수(avg)
-- 순위 제약을 1~3 에서 1~99 로 넓혀 시상대 밖 순위도 담는다(시상대는 rank<=3 만 쓴다).
-- idempotent.

alter table jnj_winners
  add column if not exists entry_no text,
  add column if not exists total_score numeric(6,2),
  add column if not exists avg_score numeric(5,2);

comment on column jnj_winners.entry_no is 'J&J Dash 참가번호. 전체 결과 표에 그대로 노출된다.';
comment on column jnj_winners.total_score is '최종(가중) 총점. 비어 있으면 화면에서 점수 줄이 사라진다.';
comment on column jnj_winners.avg_score is '심사위원 평균 점수. 총점과 함께 표시.';

-- rank 1~3 체크 해제 → 1~99. 0052 에서 이름 없이 만든 제약이라 기본 이름으로 찾는다.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'jnj_winners_rank_check') then
    alter table jnj_winners drop constraint jnj_winners_rank_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jnj_winners_rank_range') then
    alter table jnj_winners
      add constraint jnj_winners_rank_range check (rank between 1 and 99);
  end if;
end $$;
