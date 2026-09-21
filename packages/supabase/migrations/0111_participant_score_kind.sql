-- 0111: 참가자·점수·우승자에도 '종류' — J&J · BATTLE · DIV (0110 의 연장)
--
-- 부문(jnj_divisions)과 심사위원(jnj_judges)에 종류를 넣었으니(0110), 그 아래로 붙는 기록에도
-- 같은 값을 둔다. 세 테이블 모두 부문을 코드(text)로 들고 있어 종류를 코드만으로는 알 수 없다 —
-- 같은 코드가 대회마다 다른 종류일 수 있어서(예: 'open' 이 어느 대회에선 배틀) 행마다 적어 둔다.
--
-- 기존 행은 같은 대회·같은 코드의 부문에서 종류를 가져온다. 짝이 없으면 J&J 로 남는다.
-- idempotent.

do $$
declare
  t text;
begin
  foreach t in array array['jnj_participants', 'jnj_scores', 'jnj_winners'] loop
    execute format('alter table band123.%I add column if not exists kind text not null default ''jnj''', t);
    if not exists (select 1 from pg_constraint where conname = t || '_kind_check') then
      execute format(
        'alter table band123.%I add constraint %I check (kind in (''jnj'', ''battle'', ''div''))',
        t, t || '_kind_check');
    end if;
    execute format(
      'comment on column band123.%I.kind is ''종류 — jnj | battle | div. 같은 대회·코드의 부문(jnj_divisions.kind)과 같게 둔다.''', t);
    -- 부문에서 종류 되찾기
    execute format($q$
      update band123.%I r
         set kind = d.kind
        from band123.jnj_divisions d
       where d.edition_id = r.edition_id
         and d.code = r.division
         and r.kind <> d.kind
    $q$, t);
    -- 정렬 열 이름이 테이블마다 달라(우승자는 sort_order 가 없다) 종류만으로 건다.
    execute format('create index if not exists %I on band123.%I (kind)', t || '_kind_idx', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
