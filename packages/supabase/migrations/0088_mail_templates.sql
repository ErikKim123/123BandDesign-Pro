-- Design Ref: 어드민 '메일링 관리' — 메일 문구를 코드에서 DB 로 옮긴다.
--
-- 지금까지 12종 메일 문구가 전부 코드에 하드코딩돼 있어, 오타 하나 고치는 데도 배포가 필요했다.
-- 이 테이블이 원본이 되고, 발송 코드는 '있으면 쓰고 없으면 코드로 돌아간다'(폴백).
--
-- 폴백을 남겨 둔 이유: 문구를 DB 로 옮기면 DB 장애·행 삭제·비활성화가 곧바로 '메일이 안 나감'이
-- 된다. 결제확정·가입 경로에서 그건 허용할 수 없다. 관리 화면은 문구를 바꾸는 곳이지 발송을
-- 끊는 곳이 아니다.
--
-- 읽기 권한: 활성 템플릿은 익명도 읽을 수 있다. 행에는 사용자 데이터가 없고 {{변수}}
--   자리표시자뿐이며, web(서비스롤 있음)/partner(없음) 양쪽 서버에서 같은 방식으로 읽어야 해서다.
--   쓰기는 운영자만.
--
-- idempotent: create table if not exists + drop policy if exists + on conflict do nothing 시드.

create table if not exists mail_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- 코드가 참조하는 식별자. 바꾸면 폴백으로 떨어진다.
  name text not null,                       -- 화면 표시 이름
  audience text not null default 'admin' check (audience in ('admin', 'user')),
  description text,                         -- 언제 나가는 메일인지
  subject text,                             -- 운영자 메일(한국어 고정)
  body_html text,
  subject_i18n jsonb,                       -- 구매자 메일(ko/en)
  body_html_i18n jsonb,
  variables jsonb not null default '[]'::jsonb,   -- [{name,label,sample}]
  is_active boolean not null default true,
  is_system boolean not null default false, -- 코드가 참조하는 키 → 삭제 금지
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mail_templates_sort on mail_templates(sort_order, key);

comment on table mail_templates is '메일 문구 원본. 발송 코드는 키로 조회해 렌더하고, 없으면 하드코딩 본문으로 폴백한다.';
comment on column mail_templates.key is '코드가 참조하는 식별자. 임의로 바꾸면 그 메일은 하드코딩 본문으로 나간다.';
comment on column mail_templates.is_system is '코드가 참조하는 시스템 템플릿. 삭제하면 그 메일은 폴백 본문으로 나간다.';

-- updated_at 자동 갱신 (다른 테이블과 같은 방식)
create or replace function touch_mail_templates() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_touch_mail_templates on mail_templates;
create trigger trg_touch_mail_templates before update on mail_templates
  for each row execute function touch_mail_templates();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table mail_templates enable row level security;

drop policy if exists mail_templates_read_active on mail_templates;
create policy mail_templates_read_active on mail_templates for select
  using (is_active or is_admin());

drop policy if exists mail_templates_admin_write on mail_templates;
create policy mail_templates_admin_write on mail_templates for all
  using (is_admin()) with check (is_admin());

-- ── 시드: 현재 코드가 보내고 있는 12종 ──────────────────────────────────────
-- body_html 은 '안쪽 내용'만 담는다. 바깥 <div> 래퍼(폰트·행간)는 발송 코드가 씌운다.
-- on conflict do nothing — 재적용이 운영자가 고친 문구를 덮어쓰지 않게 한다.

insert into mail_templates (key, name, audience, description, sort_order, is_system, subject, body_html, variables) values

('admin_signup', '[운영] 신규 가입', 'admin',
 '회원·오거나이저·관리자가 가입하면 운영자에게. 오거나이저면 승인 버튼이 붙는다.', 10, true,
 '[123Band] 신규 {{kindLabel}} 가입: {{email}}',
 $tpl$<p style="margin:4px 0">신규 {{kindLabel}} 회원이 가입했습니다.</p>
<p style="margin:4px 0">이메일: {{email}}</p>
{{#name}}<p style="margin:4px 0">이름: {{name}}</p>{{/name}}
{{#company}}<p style="margin:4px 0">회사: {{company}}</p>{{/company}}
{{#approveUrl}}<p style="margin:16px 0 4px"><a href="{{approveUrl}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">오거나이저 승인하기</a></p>
<p style="margin:4px 0;color:#888;font-size:12px">버튼을 누르면 해당 오거나이저가 즉시 활성(승인) 처리됩니다.</p>{{/approveUrl}}$tpl$,
 $v$[{"name":"kindLabel","label":"가입 유형","sample":"오거나이저"},
     {"name":"email","label":"이메일","sample":"new@example.com"},
     {"name":"name","label":"이름","sample":"김철수"},
     {"name":"company","label":"회사명","sample":"라틴댄스컴퍼니"},
     {"name":"approveUrl","label":"승인 링크(오거나이저만)","sample":"https://123band-admin.vercel.app/partners"}]$v$::jsonb),

('admin_order_paid', '[운영] 카드 결제완료', 'admin',
 '카드(PG) 결제가 확정되면 운영자에게. 계좌이체는 별도 템플릿.', 20, true,
 '[123Band] 결제완료: {{orderNo}} ({{amountText}})',
 $tpl$<p style="margin:4px 0">카드 결제가 확정되었습니다. 배송·티켓 처리를 진행해 주세요.</p>
<p style="margin:4px 0">주문번호: {{orderNo}}</p>
<p style="margin:4px 0">주문자: {{customerName}}</p>
{{#customerEmail}}<p style="margin:4px 0">이메일: {{customerEmail}}</p>{{/customerEmail}}
{{#method}}<p style="margin:4px 0">결제수단: {{method}}</p>{{/method}}
<p style="margin:4px 0">금액: {{amountText}}</p>
<p style="margin:4px 0">주문 내역:</p>
{{#items}}<p style="margin:4px 0">&nbsp;&nbsp;· {{name}} × {{qty}}</p>{{/items}}
{{#adminUrl}}<p style="margin:16px 0 4px"><a href="{{adminUrl}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">주문 확인하기</a></p>{{/adminUrl}}$tpl$,
 $v$[{"name":"orderNo","label":"주문번호","sample":"ORD202609110930001234"},
     {"name":"amountText","label":"금액","sample":"US$215.00"},
     {"name":"customerName","label":"주문자","sample":"에리기"},
     {"name":"customerEmail","label":"주문자 이메일","sample":"buyer@example.com"},
     {"name":"method","label":"결제수단","sample":"payverse"},
     {"name":"items","label":"주문 항목 (반복)","sample":[{"name":"라틴 방콕 피에스타 2026 — 풀 패스","qty":2},{"name":"라틴 방콕 피에스타 2026 — 파티 1일권","qty":1}]},
     {"name":"adminUrl","label":"어드민 주문 링크","sample":"https://123band-admin.vercel.app/orders"}]$v$::jsonb),

('admin_transfer', '[운영] 입금 확인 요청', 'admin',
 '고객이 계좌이체·송금 후 "송금 완료"를 누르면 운영자에게.', 30, true,
 '[123Band] 송금 완료 알림: {{who}} ({{amountText}})',
 $tpl$<p style="margin:4px 0">고객이 <b>{{method}}</b> 송금을 완료했다고 알렸습니다. 입금 확인 후 주문(티켓)을 발급해 주세요.</p>
<p style="margin:4px 0">이름: {{customerName}}</p>
<p style="margin:4px 0">이메일: {{customerEmail}}</p>
{{#customerPhone}}<p style="margin:4px 0">연락처: {{customerPhone}}</p>{{/customerPhone}}
<p style="margin:4px 0">결제수단: {{method}}</p>
<p style="margin:4px 0">금액: {{amountText}}</p>
<p style="margin:4px 0">주문 내역:</p>
{{#items}}<p style="margin:4px 0">&nbsp;&nbsp;· {{name}} × {{qty}}</p>{{/items}}$tpl$,
 $v$[{"name":"who","label":"제목용 이름","sample":"에리기"},
     {"name":"method","label":"결제수단","sample":"계좌이체/송금"},
     {"name":"customerName","label":"주문자","sample":"에리기"},
     {"name":"customerEmail","label":"이메일","sample":"buyer@example.com"},
     {"name":"customerPhone","label":"연락처","sample":"010-1234-5678"},
     {"name":"amountText","label":"금액","sample":"KRW 238000"},
     {"name":"items","label":"주문 항목 (반복)","sample":[{"name":"보홀 라틴 페스티벌","qty":1}]}]$v$::jsonb),

('admin_qna', '[운영] 상품문의 등록', 'admin',
 '고객이 상품문의(QnA)를 남기면 운영자에게.', 40, true,
 '[123Band] 상품문의: {{productName}}',
 $tpl$<p style="margin:4px 0">고객이 상품문의를 남겼습니다. 답변해 주세요.</p>
<p style="margin:4px 0">상품: {{productName}}</p>
<p style="margin:4px 0">작성자: {{authorName}}{{#authorEmail}} ({{authorEmail}}){{/authorEmail}}</p>
<p style="margin:4px 0">내용:</p>
<p style="margin:4px 0">&nbsp;&nbsp;{{question}}</p>
{{#adminUrl}}<p style="margin:16px 0 4px"><a href="{{adminUrl}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">문의 답변하기</a></p>{{/adminUrl}}$tpl$,
 $v$[{"name":"productName","label":"상품명","sample":"라틴 방콕 피에스타 2026"},
     {"name":"authorName","label":"작성자","sample":"김철수"},
     {"name":"authorEmail","label":"작성자 이메일","sample":"asker@example.com"},
     {"name":"question","label":"문의 내용","sample":"주차 가능한가요?"},
     {"name":"adminUrl","label":"어드민 문의 링크","sample":"https://123band-admin.vercel.app/product-qna"}]$v$::jsonb),

('admin_review', '[운영] 상품후기 등록', 'admin',
 '고객이 후기를 쓰거나 고치면 운영자에게. 3점 이하면 제목에 경고 표시가 붙는다.', 50, true,
 '[123Band] 상품후기 {{rating}}점{{#lowRating}} ⚠️{{/lowRating}}: {{productName}}',
 $tpl$<p style="margin:4px 0">고객이 상품후기를 {{actionLabel}}했습니다.</p>
<p style="margin:4px 0">상품: {{productName}}</p>
<p style="margin:4px 0">별점: {{stars}} ({{rating}}/5)</p>
<p style="margin:4px 0">작성자: {{authorName}}{{#authorEmail}} ({{authorEmail}}){{/authorEmail}}</p>
<p style="margin:4px 0">내용:</p>
<p style="margin:4px 0">&nbsp;&nbsp;{{content}}</p>
{{#adminUrl}}<p style="margin:16px 0 4px"><a href="{{adminUrl}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">후기 확인하기</a></p>{{/adminUrl}}$tpl$,
 $v$[{"name":"productName","label":"상품명","sample":"라틴 방콕 피에스타 2026"},
     {"name":"rating","label":"별점(숫자)","sample":5},
     {"name":"stars","label":"별점(별표)","sample":"★★★★★"},
     {"name":"lowRating","label":"3점 이하 여부","sample":false},
     {"name":"actionLabel","label":"작성/수정","sample":"작성"},
     {"name":"authorName","label":"작성자","sample":"김철수"},
     {"name":"authorEmail","label":"작성자 이메일","sample":"reviewer@example.com"},
     {"name":"content","label":"후기 내용","sample":"음악이 최고였어요!"},
     {"name":"adminUrl","label":"어드민 후기 링크","sample":"https://123band-admin.vercel.app/product-reviews"}]$v$::jsonb),

('admin_coupon_issued', '[운영] 쿠폰 발급', 'admin',
 '스탬프 카드 완성 또는 포인트 교환으로 쿠폰이 나가면 운영자에게. 비용이 나가는 이벤트다.', 60, true,
 '[123Band] 쿠폰 발급 — {{sourceLabel}}: {{customerName}}',
 $tpl$<p style="margin:4px 0">{{sourceLabel}}으로 쿠폰이 발급되었습니다.</p>
<p style="margin:4px 0">회원: {{customerName}}</p>
{{#customerEmail}}<p style="margin:4px 0">이메일: {{customerEmail}}</p>{{/customerEmail}}
<p style="margin:4px 0">쿠폰: {{couponName}} ({{discountText}})</p>
<p style="margin:4px 0">발급코드: {{code}}</p>
{{#pointCost}}<p style="margin:4px 0">차감 포인트: {{pointCost}} P</p>{{/pointCost}}
{{#expiresAt}}<p style="margin:4px 0">사용기한: {{expiresAt}}</p>{{/expiresAt}}$tpl$,
 $v$[{"name":"sourceLabel","label":"발급 사유","sample":"스탬프 카드 완성"},
     {"name":"customerName","label":"회원","sample":"에리기"},
     {"name":"customerEmail","label":"이메일","sample":"member@example.com"},
     {"name":"couponName","label":"쿠폰명","sample":"1만원 할인"},
     {"name":"discountText","label":"할인 내용","sample":"10,000원"},
     {"name":"code","label":"발급코드","sample":"BAND-8F2K-9931"},
     {"name":"pointCost","label":"차감 포인트","sample":"3,000"},
     {"name":"expiresAt","label":"사용기한","sample":"2026-12-31"}]$v$::jsonb),

('admin_stamp_reward', '[운영] 스탬프 카드 완성', 'admin',
 '스탬프 카드가 완성되어 포인트가 지급되면 운영자에게.', 70, true,
 '[123Band] 스탬프 카드 완성 — {{customerName}}',
 $tpl$<p style="margin:4px 0">스탬프 카드가 완성되어 포인트가 지급되었습니다.</p>
<p style="margin:4px 0">회원: {{customerName}}</p>
{{#customerEmail}}<p style="margin:4px 0">이메일: {{customerEmail}}</p>{{/customerEmail}}
<p style="margin:4px 0">지급 포인트: {{points}} P</p>
{{#balanceAfter}}<p style="margin:4px 0">지급 후 잔액: {{balanceAfter}} P</p>{{/balanceAfter}}
{{#adminUrl}}<p style="margin:16px 0 4px"><a href="{{adminUrl}}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600">스탬프 확인하기</a></p>{{/adminUrl}}$tpl$,
 $v$[{"name":"customerName","label":"회원","sample":"에리기"},
     {"name":"customerEmail","label":"이메일","sample":"member@example.com"},
     {"name":"points","label":"지급 포인트","sample":"5,000"},
     {"name":"balanceAfter","label":"지급 후 잔액","sample":"12,500"},
     {"name":"adminUrl","label":"어드민 스탬프 링크","sample":"https://123band-admin.vercel.app/stamps"}]$v$::jsonb),

('admin_approval', '[운영] 상품·행사패스 승인요청', 'admin',
 '오거나이저가 상품/행사패스 승인을 요청(draft→pending)하면 운영자에게.', 80, true,
 '[123Band] {{kindLabel}} 승인요청: {{name}}',
 $tpl$<p style="margin:4px 0">오거나이저가 {{kindLabel}} 승인을 요청했습니다.</p>
<p style="margin:4px 0">{{kindLabel}}명: {{name}}</p>
{{#partner}}<p style="margin:4px 0">오거나이저: {{partner}}</p>{{/partner}}
<p style="margin:4px 0">어드민에서 검토 후 승인/반려하세요.</p>$tpl$,
 $v$[{"name":"kindLabel","label":"종류","sample":"행사패스"},
     {"name":"name","label":"상품/패스명","sample":"보홀 라틴 페스티벌 2026"},
     {"name":"partner","label":"오거나이저","sample":"라틴댄스컴퍼니"}]$v$::jsonb),

('admin_alert', '[운영] 시스템 경고', 'admin',
 '결제 점검 실패 등 시스템 경고. 제목과 본문 줄이 호출부에서 통째로 넘어온다.', 90, true,
 '[123Band] {{alertSubject}}',
 $tpl${{#lines}}<p style="margin:4px 0">{{.}}</p>{{/lines}}$tpl$,
 $v$[{"name":"alertSubject","label":"경고 제목","sample":"카카오페이 점검 실패"},
     {"name":"lines","label":"본문 줄 (반복)","sample":["결제 점검에 실패했습니다.","응답 코드: 500"]}]$v$::jsonb)

on conflict (key) do nothing;


-- ── 구매자에게 나가는 메일 (한국어·영어) ─────────────────────────────────────

insert into mail_templates (key, name, audience, description, sort_order, is_system, subject_i18n, body_html_i18n, variables) values

('user_order_confirmation', '[고객] 구매확인', 'user',
 '결제가 확정되면 구매자에게 1회. 티켓이 있으면 QR 입장 안내가 붙는다. 오거나이저가 재발송할 수도 있다.', 100, true,
 $s${"ko":"[123Band] 구매가 완료되었습니다 · {{orderNo}}","en":"[123Band] Your order is confirmed · {{orderNo}}"}$s$::jsonb,
 $b${"ko":"<p style=\"margin:0 0 4px;font-size:17px;font-weight:700\">{{#buyerName}}{{buyerName}}님, 구매해 주셔서 감사합니다.{{/buyerName}}{{^buyerName}}구매해 주셔서 감사합니다.{{/buyerName}}</p>\n<p style=\"margin:0 0 20px;color:#5a5a5a\">아래 내용으로 결제가 완료되었습니다.</p>\n{{#resend}}<p style=\"margin:0 0 18px;padding:10px 12px;border-radius:8px;background:#f4f4f4;color:#5a5a5a;font-size:13px\">오거나이저가 이 확인서를 다시 보냈습니다. 이미 받으셨다면 무시하셔도 됩니다.</p>{{/resend}}\n<table style=\"width:100%;border-collapse:collapse;font-size:14px\">\n<tr><td style=\"padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap\">주문번호</td><td style=\"padding:6px 0;font-weight:600\">{{orderNo}}</td></tr>\n{{#paidAtText}}<tr><td style=\"padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap\">결제일시</td><td style=\"padding:6px 0;font-weight:600\">{{paidAtText}}</td></tr>{{/paidAtText}}\n{{#methodLabel}}<tr><td style=\"padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap\">결제수단</td><td style=\"padding:6px 0;font-weight:600\">{{methodLabel}}</td></tr>{{/methodLabel}}\n<tr><td style=\"padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap\">결제금액</td><td style=\"padding:6px 0;font-weight:600\">{{amountText}}</td></tr>\n</table>\n<p style=\"margin:24px 0 4px;font-size:13px;font-weight:700;color:#8a8a8a;letter-spacing:.06em\">주문 내역</p>\n<table style=\"width:100%;border-collapse:collapse;font-size:14px\">\n{{#items}}<tr><td style=\"padding:8px 0;border-top:1px solid #eee\">{{name}}</td><td style=\"padding:8px 0;border-top:1px solid #eee;color:#666;text-align:right;white-space:nowrap\">× {{qty}}</td></tr>{{/items}}\n</table>\n{{#hasTicket}}<div style=\"margin:28px 0 0;padding:18px;border:1px solid #ffd9c7;border-radius:12px;background:#fff8f4\">\n<p style=\"margin:0 0 10px;font-size:16px;font-weight:700\">입장은 QR 코드로 합니다</p>\n<ol style=\"margin:0;padding-left:20px;color:#3a3a3a\">\n<li style=\"margin:6px 0\">행사 당일 <b>주문내역 화면</b>을 열어 QR 코드를 띄웁니다.</li>\n<li style=\"margin:6px 0\">입구에서 오거나이저에게 <b>화면을 그대로 보여주세요.</b> 스캔하면 입장 처리됩니다.</li>\n<li style=\"margin:6px 0\">티켓을 여러 장 사셨다면 <b>1장당 QR 이 각각</b> 있습니다. 함께 입장하는 분마다 한 장씩 스캔합니다.</li>\n</ol>\n<p style=\"margin:16px 0 6px;font-size:13px;font-weight:700\">꼭 알아두세요</p>\n<ul style=\"margin:0;padding-left:20px;color:#3a3a3a;font-size:13px\">\n<li style=\"margin:6px 0\"><b>QR 은 이 메일에 담지 않습니다.</b> 캡처본이 돌면 다른 사람이 대신 입장할 수 있어서, 로그인한 본인 화면에서만 열립니다.</li>\n<li style=\"margin:6px 0\">티켓을 <b>선물하면 QR 이 새로 바뀝니다.</b> 예전에 찍어둔 화면은 입장되지 않으니, 현장에서는 스크린샷 말고 <b>화면을 새로 열어</b> 보여주세요.</li>\n<li style=\"margin:6px 0\">입장이 끝난 QR 은 <b>사용 완료</b>로 표시되고 다시 쓸 수 없습니다.</li>\n</ul>\n<p style=\"margin:18px 0 0\"><a href=\"{{ordersUrl}}\" style=\"display:inline-block;background:#ff5a1f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:24px;font-weight:700\">주문내역에서 QR 열기</a></p>\n</div>{{/hasTicket}}\n{{^hasTicket}}<p style=\"margin:24px 0 0\"><a href=\"{{ordersUrl}}\" style=\"display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 20px;border-radius:24px;font-weight:600\">주문내역 바로가기</a></p>{{/hasTicket}}\n<p style=\"margin:28px 0 0;padding-top:16px;border-top:1px solid #eee;color:#9a9a9a;font-size:12px\">문의는 이 메일에 그대로 답장해 주세요.</p>","en":"<p style=\"margin:0 0 4px;font-size:17px;font-weight:700\">{{#buyerName}}{{buyerName}}, thank you for your purchase.{{/buyerName}}{{^buyerName}}Thank you for your purchase.{{/buyerName}}</p>\n<p style=\"margin:0 0 20px;color:#5a5a5a\">Your payment has been completed.</p>\n{{#resend}}<p style=\"margin:0 0 18px;padding:10px 12px;border-radius:8px;background:#f4f4f4;color:#5a5a5a;font-size:13px\">The organizer sent this confirmation again. If you already have it, you can ignore this.</p>{{/resend}}\n<table style=\"width:100%;border-collapse:collapse;font-size:14px\">\n<tr><td style=\"padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap\">Order number</td><td style=\"padding:6px 0;font-weight:600\">{{orderNo}}</td></tr>\n{{#paidAtText}}<tr><td style=\"padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap\">Paid at</td><td style=\"padding:6px 0;font-weight:600\">{{paidAtText}}</td></tr>{{/paidAtText}}\n{{#methodLabel}}<tr><td style=\"padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap\">Payment method</td><td style=\"padding:6px 0;font-weight:600\">{{methodLabel}}</td></tr>{{/methodLabel}}\n<tr><td style=\"padding:6px 12px 6px 0;color:#8a8a8a;white-space:nowrap\">Total paid</td><td style=\"padding:6px 0;font-weight:600\">{{amountText}}</td></tr>\n</table>\n<p style=\"margin:24px 0 4px;font-size:13px;font-weight:700;color:#8a8a8a;letter-spacing:.06em\">ORDER DETAILS</p>\n<table style=\"width:100%;border-collapse:collapse;font-size:14px\">\n{{#items}}<tr><td style=\"padding:8px 0;border-top:1px solid #eee\">{{name}}</td><td style=\"padding:8px 0;border-top:1px solid #eee;color:#666;text-align:right;white-space:nowrap\">× {{qty}}</td></tr>{{/items}}\n</table>\n{{#hasTicket}}<div style=\"margin:28px 0 0;padding:18px;border:1px solid #ffd9c7;border-radius:12px;background:#fff8f4\">\n<p style=\"margin:0 0 10px;font-size:16px;font-weight:700\">You get in with a QR code</p>\n<ol style=\"margin:0;padding-left:20px;color:#3a3a3a\">\n<li style=\"margin:6px 0\">On the event day, open your <b>order history</b> to bring up the QR code.</li>\n<li style=\"margin:6px 0\"><b>Show the screen</b> to the organizer at the entrance. Scanning it checks you in.</li>\n<li style=\"margin:6px 0\">If you bought several tickets, <b>each ticket has its own QR</b>. One scan per person entering.</li>\n</ol>\n<p style=\"margin:16px 0 6px;font-size:13px;font-weight:700\">Please note</p>\n<ul style=\"margin:0;padding-left:20px;color:#3a3a3a;font-size:13px\">\n<li style=\"margin:6px 0\"><b>The QR is not included in this email.</b> A forwarded screenshot would let someone else walk in, so it only opens on your own signed-in screen.</li>\n<li style=\"margin:6px 0\">If you <b>gift a ticket, its QR is replaced.</b> An old screenshot will not scan — open the screen fresh at the venue instead.</li>\n<li style=\"margin:6px 0\">Once used, a QR is marked <b>used</b> and cannot be scanned again.</li>\n</ul>\n<p style=\"margin:18px 0 0\"><a href=\"{{ordersUrl}}\" style=\"display:inline-block;background:#ff5a1f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:24px;font-weight:700\">Open the QR in your orders</a></p>\n</div>{{/hasTicket}}\n{{^hasTicket}}<p style=\"margin:24px 0 0\"><a href=\"{{ordersUrl}}\" style=\"display:inline-block;background:#111;color:#fff;text-decoration:none;padding:11px 20px;border-radius:24px;font-weight:600\">Go to order history</a></p>{{/hasTicket}}\n<p style=\"margin:28px 0 0;padding-top:16px;border-top:1px solid #eee;color:#9a9a9a;font-size:12px\">Just reply to this email if you need help.</p>"}$b$::jsonb,
 $v$[
  {
    "name": "orderNo",
    "label": "주문번호",
    "sample": "ORD202609110930001234"
  },
  {
    "name": "buyerName",
    "label": "구매자 이름",
    "sample": "에리기",
    "sampleI18n": {
      "ko": "에리기",
      "en": "Rotcin"
    }
  },
  {
    "name": "amountText",
    "label": "결제금액",
    "sample": "US$215.00"
  },
  {
    "name": "methodLabel",
    "label": "결제수단",
    "sample": "카드",
    "sampleI18n": {
      "ko": "카드",
      "en": "Card"
    }
  },
  {
    "name": "paidAtText",
    "label": "결제일시",
    "sample": "2026. 09. 11. 09:30 (KST)",
    "sampleI18n": {
      "ko": "2026. 09. 11. 09:30 (KST)",
      "en": "09/11/2026, 09:30 AM (KST)"
    }
  },
  {
    "name": "items",
    "label": "주문 항목 (반복)",
    "sample": [
      {
        "name": "라틴 방콕 피에스타 2026 — 풀 패스",
        "qty": 2
      },
      {
        "name": "라틴 방콕 피에스타 2026 — 파티 1일권",
        "qty": 1
      }
    ],
    "sampleI18n": {
      "ko": [
        {
          "name": "라틴 방콕 피에스타 2026 — 풀 패스",
          "qty": 2
        },
        {
          "name": "라틴 방콕 피에스타 2026 — 파티 1일권",
          "qty": 1
        }
      ],
      "en": [
        {
          "name": "Latin Bangkok Fiesta 2026 — Full Pass",
          "qty": 2
        },
        {
          "name": "Latin Bangkok Fiesta 2026 — Party Day Pass",
          "qty": 1
        }
      ]
    }
  },
  {
    "name": "hasTicket",
    "label": "티켓 포함 여부",
    "sample": true
  },
  {
    "name": "resend",
    "label": "재발송 여부",
    "sample": false
  },
  {
    "name": "ordersUrl",
    "label": "주문내역 링크",
    "sample": "https://123band-web.vercel.app/ko/account/orders",
    "sampleI18n": {
      "ko": "https://123band-web.vercel.app/ko/account/orders",
      "en": "https://123band-web.vercel.app/en/account/orders"
    }
  }
]$v$::jsonb),

('user_heart_digest', '[고객] 어제 받은 하트', 'user',
 '매일 0시(KST) 크론. 전날 하트를 받은 회원에게 요약을 보낸다. 마이페이지에서 수신 거부 가능.', 110, true,
 $s${"ko":"[123Band] 어제 받은 하트 {{heartCount}}개","en":"[123Band] You received {{heartCount}} hearts yesterday"}$s$::jsonb,
 $b${"ko":"<p style=\"margin:4px 0\">{{#name}}{{name}} 님, {{/name}}어제 하트 <b>{{heartCount}}개</b>를 받았어요.</p>\n{{#who}}<p style=\"margin:4px 0;color:#555\">보낸 사람: {{who}}{{more}}</p>{{/who}}\n<p style=\"margin:16px 0 4px\"><a href=\"{{socialUrl}}\" style=\"display:inline-block;background:#fa520f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600\">소셜 탭에서 보기</a></p>\n<p style=\"margin:12px 0 0;color:#888;font-size:12px\">이 메일이 필요 없으면 마이페이지 &gt; 소셜 탭의 알림 설정에서 끌 수 있습니다.</p>","en":"<p style=\"margin:4px 0\">{{#name}}{{name}}, {{/name}}you received <b>{{heartCount}} hearts</b> yesterday.</p>\n{{#who}}<p style=\"margin:4px 0;color:#555\">From: {{who}}{{more}}</p>{{/who}}\n<p style=\"margin:16px 0 4px\"><a href=\"{{socialUrl}}\" style=\"display:inline-block;background:#fa520f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:24px;font-weight:600\">See it in Social</a></p>\n<p style=\"margin:12px 0 0;color:#888;font-size:12px\">You can turn this off in My Page &gt; Social &gt; notification settings.</p>"}$b$::jsonb,
 $v$[
  {
    "name": "name",
    "label": "회원 이름",
    "sample": "에리기",
    "sampleI18n": {
      "ko": "에리기",
      "en": "Rotcin"
    }
  },
  {
    "name": "heartCount",
    "label": "받은 하트 수",
    "sample": 7
  },
  {
    "name": "who",
    "label": "보낸 사람 목록",
    "sample": "김철수, 이영희",
    "sampleI18n": {
      "ko": "김철수, 이영희",
      "en": "Sofia, Monika"
    }
  },
  {
    "name": "more",
    "label": "외 N명",
    "sample": " 외 3명",
    "sampleI18n": {
      "ko": " 외 3명",
      "en": " and 3 more"
    }
  },
  {
    "name": "socialUrl",
    "label": "소셜 탭 링크",
    "sample": "https://123band-web.vercel.app/ko/account/social",
    "sampleI18n": {
      "ko": "https://123band-web.vercel.app/ko/account/social",
      "en": "https://123band-web.vercel.app/en/account/social"
    }
  }
]$v$::jsonb),

('user_newsletter_wrapper', '[고객] 뉴스레터 껍데기', 'user',
 '뉴스레터 발송 시 본문을 감싸는 머리말·꼬리말. 본문 내용은 뉴스레터 화면에서 작성하며 {{{content}}} 자리에 들어간다.', 120, true,
 $s${"ko":"{{subject}}","en":"{{subject}}"}$s$::jsonb,
 $b${"ko":"<div style=\"padding:8px 0 16px;border-bottom:1px solid #eee;font-weight:700;letter-spacing:.5px\">123Band</div>\n<div style=\"padding:16px 0\">{{{content}}}</div>\n<div style=\"padding:16px 0;border-top:1px solid #eee;color:#999;font-size:12px\">이 메일은 123Band 뉴스레터를 구독하신 분께 발송되었습니다.</div>","en":"<div style=\"padding:8px 0 16px;border-bottom:1px solid #eee;font-weight:700;letter-spacing:.5px\">123Band</div>\n<div style=\"padding:16px 0\">{{{content}}}</div>\n<div style=\"padding:16px 0;border-top:1px solid #eee;color:#999;font-size:12px\">You are receiving this because you subscribed to the 123Band newsletter.</div>"}$b$::jsonb,
 $v$[
  {
    "name": "subject",
    "label": "뉴스레터 제목",
    "sample": "9월 라틴 페스티벌 소식",
    "sampleI18n": {
      "ko": "9월 라틴 페스티벌 소식",
      "en": "September festival news"
    }
  },
  {
    "name": "content",
    "label": "본문 (뉴스레터 화면에서 작성 · HTML 그대로)",
    "sample": "<p>이번 달 새 행사가 열립니다.</p>",
    "sampleI18n": {
      "ko": "<p>이번 달 새 행사가 열립니다.</p>",
      "en": "<p>New events are opening this month.</p>"
    }
  }
]$v$::jsonb)

on conflict (key) do nothing;
