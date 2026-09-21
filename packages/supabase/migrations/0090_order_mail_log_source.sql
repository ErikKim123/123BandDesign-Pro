-- Design Ref: 0089 발송 기록에 '어디서 온 기록인지'를 붙인다.
--
-- 0089 은 sent_by 가 null 이면 자동 발송으로 읽었다. 그런데 Brevo 로그에서 과거 발송분을
-- 되살릴 때는 '누가 눌렀는지'를 알 수 없어 sent_by 가 null 이 된다 — 사람이 눌러 보낸 메일이
-- 화면에 '자동 발송'으로 찍힌다. 기록을 채워 넣으려다 거짓말을 만드는 셈이다.
--
-- source 로 셋을 구분한다:
--   auto     결제확정 시 코드가 보냄
--   manual   파트너 포털에서 사람이 ✉ 를 눌러 보냄 (sent_by 에 누군지 남는다)
--   backfill Brevo 발송 로그에서 되살린 과거 기록 (누가 보냈는지는 알 수 없음)
--
-- provider_message_id 에 유니크를 건다 — 백필을 여러 번 돌려도 같은 메일이 겹쳐 쌓이지 않게.
-- (null 은 유니크 제약에서 서로 충돌하지 않으므로 기존 자동/수동 기록에는 영향이 없다.)
--
-- idempotent: add column if not exists + create unique index if not exists.

alter table order_mail_log
  add column if not exists source text not null default 'auto'
    check (source in ('auto', 'manual', 'backfill'));

comment on column order_mail_log.source is
  'auto=결제확정 자동발송, manual=사람이 재발송 버튼, backfill=Brevo 로그에서 복원(누가 보냈는지 불명).';

-- 이미 쌓인 행 중 sent_by 가 있는 것은 사람이 누른 것이다(0089 의 규칙).
update order_mail_log set source = 'manual' where sent_by is not null and source = 'auto';

create unique index if not exists uq_order_mail_log_message
  on order_mail_log(provider_message_id)
  where provider_message_id is not null;
