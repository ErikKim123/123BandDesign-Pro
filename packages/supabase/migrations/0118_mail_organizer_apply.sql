-- 0118: 오거나이저 신청 알림 메일 템플릿 + 운영자 수신자 설정 자리
--
-- 신청(0116)은 사람이 심사해야 끝난다. 아무도 모르는 채로 '심사 중'에 며칠 머물면 그 사람은
-- 행사를 못 연다. 그래서 신청이 들어오면 운영자에게 메일이 나가고, 문구는 다른 운영자 메일과
-- 똑같이 어드민 '메일링 관리'에서 고칠 수 있어야 한다(0088 의 카탈로그에 한 줄 더한다).
--
-- 수신자는 app_settings['notify.admin_emails'] 에 둔다. 예전에는 ADMIN_NOTIFY_EMAIL
-- 환경변수뿐이라, 받는 사람이 바뀔 때마다 Vercel 세 곳을 고치고 재배포해야 했다.
-- 행을 미리 만들어 두지는 않는다 — 비어 있으면 발송 쪽이 환경변수로 폴백한다.
-- idempotent.

insert into mail_templates (key, name, audience, description, sort_order, is_system, subject, body_html, variables) values

('admin_organizer_apply', '[운영] 오거나이저 신청', 'admin',
 '회원이 주최자 약관에 동의하고 오거나이저 신청을 내면 운영자에게. 심사 화면 링크가 붙는다.', 85, true,
 '[123Band] 오거나이저 신청: {{company}}',
 $tpl$<p style="margin:4px 0">회원이 오거나이저 신청을 냈습니다. 약관 동의까지 마친 상태이니 심사해 주세요.</p>
<p style="margin:4px 0">회사/단체: {{company}}</p>
<p style="margin:4px 0">신청자: {{applicant}}</p>
{{#country}}<p style="margin:4px 0">국가: {{country}}</p>{{/country}}
{{#contact}}<p style="margin:4px 0">연락처: {{contact}}</p>{{/contact}}
{{#bizNo}}<p style="margin:4px 0">사업자번호: {{bizNo}}</p>{{/bizNo}}
{{#intro}}<p style="margin:4px 0">소개:</p>
<p style="margin:4px 0 4px 12px;color:#444">{{intro}}</p>{{/intro}}
{{#adminUrl}}<p style="margin:16px 0 4px"><a href="{{adminUrl}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">신청 심사하기</a></p>{{/adminUrl}}$tpl$,
 $v$[{"name":"company","label":"회사/단체명","sample":"서울 라틴 페스티벌"},
     {"name":"applicant","label":"신청자","sample":"김에릭 (organizer@example.com)"},
     {"name":"email","label":"이메일","sample":"organizer@example.com"},
     {"name":"name","label":"이름","sample":"김에릭"},
     {"name":"country","label":"국가","sample":"KR"},
     {"name":"contact","label":"연락처","sample":"010-1234-5678"},
     {"name":"bizNo","label":"사업자번호","sample":"123-45-67890"},
     {"name":"intro","label":"소개","sample":"매년 봄 서울에서 라틴 페스티벌을 엽니다."},
     {"name":"adminUrl","label":"어드민 심사 링크","sample":"https://123band-admin.vercel.app/organizer-contracts"}]$v$::jsonb)

on conflict (key) do nothing;

comment on table app_settings is
  '전역 설정 키-값. notify.admin_emails = 운영자 알림 메일 수신자 {"emails":[...]} (최대 5개, 비면 ADMIN_NOTIFY_EMAIL 로 폴백).';

notify pgrst, 'reload schema';
