-- 0041: 시범 업적을 '첫 구매' → '뉴스레터 구독' 으로 정정.
-- 배경: 0040 에서 시드한 first_purchase 업적에 등록된 뱃지 이미지가 'Newsletter' 뱃지였고,
--       실제 운영 의도도 '뉴스레터를 구독하면 주는 뱃지' 였다.
--       조건도 (뉴스레터 구독 AND 패스 1개 구매) → (뉴스레터 구독) 으로 단순화한다.
-- 획득 이력(user_achievements)은 achievement_id 를 그대로 유지해야 하므로
-- 행을 지우지 않고 code/문구/조건만 갱신한다.
-- 뱃지 이미지(badge_image_url)는 어드민 > 업적관리 에서 업로드하는 값이라 여기서 건드리지 않는다.
-- idempotent.

do $$
begin
  -- 이미 정정된 DB(0041 재실행 / REST 로 선반영)면 남은 first_purchase 행만 정리한다.
  if exists (select 1 from achievements where code = 'newsletter_subscribe') then
    delete from achievements a
     where a.code = 'first_purchase'
       and not exists (select 1 from user_achievements ua where ua.achievement_id = a.id);

  elsif exists (select 1 from achievements where code = 'first_purchase') then
    update achievements set
      code             = 'newsletter_subscribe',
      name_i18n        = '{"ko":"뉴스레터 구독","en":"Newsletter Subscriber"}'::jsonb,
      description_i18n = '{"ko":"뉴스레터를 구독하면 획득해요.","en":"Subscribe to the newsletter to earn this badge."}'::jsonb,
      conditions       = '[{"type":"newsletter_subscribed"}]'::jsonb,
      updated_at       = now()
    where code = 'first_purchase';

  else
    insert into achievements (code, name_i18n, description_i18n, conditions, point_reward, sort_order)
    values (
      'newsletter_subscribe',
      '{"ko":"뉴스레터 구독","en":"Newsletter Subscriber"}'::jsonb,
      '{"ko":"뉴스레터를 구독하면 획득해요.","en":"Subscribe to the newsletter to earn this badge."}'::jsonb,
      '[{"type":"newsletter_subscribed"}]'::jsonb,
      0,
      1
    )
    on conflict (code) do nothing;
  end if;
end;
$$;

-- 조건이 느슨해졌으므로 기존 구독자에게 소급 적용한다.
do $$
declare r record;
begin
  for r in select id from profiles where role = 'customer' loop
    perform evaluate_achievements_for(r.id);
  end loop;
end;
$$;
