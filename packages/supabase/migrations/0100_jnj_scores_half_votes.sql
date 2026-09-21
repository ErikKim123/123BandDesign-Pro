-- 0100: 성적표 득표를 반 표까지 담는다 (votes int → numeric(6,1)).
--
-- J&J Dash 예선·본선 판정에 MAY(1/2표)가 생겼다. O 하나가 1표, 1/2 하나가 0.5표라
-- 득표 합계가 12.5 처럼 나온다 — 정원 경계에 동점자가 쌓이는 문제를 풀려고 넣은 눈금이다.
--
-- jnj_scores.votes 가 integer 로 남아 있으면 12.5 를 13 으로 반올림해 저장한다. 그러면
-- 동점을 가르려고 만든 값이 고객몰 성적표에서 도로 뭉개지고, J&J Dash 어드민과 숫자가 어긋난다
-- (같은 대회인데 12.5 와 13 이 따로 보인다).
--
-- J&J Dash 쪽 qualifiers.votes 는 이미 numeric(6,1) 이다 (jnj-dash 0041). 같은 자릿수로 맞춘다.
--
-- 기존 데이터는 그대로다 — 정수는 numeric 으로 손실 없이 옮겨지고, 1/2 표가 없는 대회는
-- 예전과 같은 정수로 보인다.
-- idempotent.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'jnj_scores'
      and column_name = 'votes' and data_type = 'integer'
  ) then
    alter table jnj_scores
      alter column votes type numeric(6,1) using votes::numeric(6,1);
  end if;
end $$;

comment on column jnj_scores.votes is
  '라운드 득표 합계. J&J Dash 판정 O=1 · MAY(1/2)=0.5 로 더한 값이라 12.5 같은 반 표가 나올 수 있다.';
