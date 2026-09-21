-- 0030: 전역 설정(app_settings) — 어드민 전용 키-값 저장소.
-- 첫 사용처: SNS(인스타그램) 계정 핸들 + 액세스 토큰. 값은 jsonb 로 자유 확장.
-- 토큰 등 민감정보를 담으므로 읽기·쓰기 모두 어드민만 허용(anon/파트너 불가).

create table if not exists app_settings (
  key text primary key,                                  -- 예: 'sns.instagram'
  value jsonb not null default '{}'::jsonb,              -- 예: {"handle":"latindada","token":"..."}
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "app_settings_admin_all" on app_settings;
create policy "app_settings_admin_all" on app_settings
  for all using (is_admin()) with check (is_admin());
