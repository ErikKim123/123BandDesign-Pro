-- Design Ref: 코드관리 삭제 전 사용 여부 확인.
--
-- 코드값은 다른 테이블에 '문자열 그대로' 저장된다(외래키가 아니다). 그래서 DB 가 막아 주지 않고,
-- 지워도 아무 일 없이 성공한다 — 대신 화면에서 그 코드가 코드명 없이 raw 값으로 나오기 시작한다.
-- 지우기 전에 어디서 몇 건이 쓰고 있는지 세어 준다.
--
-- 그룹마다 참조처가 다르다:
--   jnj_division → jnj_divisions.code, jnj_winners/scores/participants.division
--   jnj_role     → jnj_winners/scores/participants.role
-- 새 그룹을 추가하면 여기에 분기를 하나 더 넣는다. 참조처를 모르는 그룹은 빈 객체를 돌려주고,
-- 화면은 '확인할 수 없음'이 아니라 '쓰는 곳 없음'으로 다룬다 — 모르는 그룹까지 막으면
-- 코드관리에서 아무것도 지울 수 없게 된다.
--
-- idempotent: create or replace.

create or replace function code_value_usage(p_group text, p_codes text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = band123
as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_code text;
  v_one jsonb;
  v_n int;
begin
  if p_codes is null or array_length(p_codes, 1) is null then return v_out; end if;

  foreach v_code in array p_codes loop
    v_one := '{}'::jsonb;

    if p_group = 'jnj_division' then
      select count(*)::int into v_n from jnj_divisions where code = v_code;
      if v_n > 0 then v_one := v_one || jsonb_build_object('부문', v_n); end if;

      select count(*)::int into v_n from jnj_winners where division = v_code;
      if v_n > 0 then v_one := v_one || jsonb_build_object('우승자', v_n); end if;

      select count(*)::int into v_n from jnj_scores where division = v_code;
      if v_n > 0 then v_one := v_one || jsonb_build_object('점수', v_n); end if;

      select count(*)::int into v_n from jnj_participants where division = v_code;
      if v_n > 0 then v_one := v_one || jsonb_build_object('참가자', v_n); end if;

    elsif p_group = 'jnj_role' then
      select count(*)::int into v_n from jnj_winners where role = v_code;
      if v_n > 0 then v_one := v_one || jsonb_build_object('우승자', v_n); end if;

      select count(*)::int into v_n from jnj_scores where role = v_code;
      if v_n > 0 then v_one := v_one || jsonb_build_object('점수', v_n); end if;

      select count(*)::int into v_n from jnj_participants where role = v_code;
      if v_n > 0 then v_one := v_one || jsonb_build_object('참가자', v_n); end if;
    end if;

    if v_one <> '{}'::jsonb then
      v_out := v_out || jsonb_build_object(v_code, v_one);
    end if;
  end loop;

  return v_out;
end;
$$;

comment on function code_value_usage(text, text[]) is
  '코드값이 쓰이고 있는 곳과 건수 — {코드: {참조처: 건수}}. 쓰는 곳이 없는 코드는 아예 빠진다. 참조처를 모르는 그룹은 빈 객체.';

revoke all on function code_value_usage(text, text[]) from public;
revoke all on function code_value_usage(text, text[]) from anon;
grant execute on function code_value_usage(text, text[]) to authenticated;
