-- 0081_member_notices_delete.sql
-- 회원이 받은 알림을 지울 수 있게 한다.
--
-- 0080 은 회원에게 읽기만 열어 두었다(쓰기는 운영자만). UPDATE 를 열지 않은 이유는
-- 회원이 남의... 정확히는 자기에게 온 알림의 '내용'을 고칠 길이 생기기 때문이었다.
-- DELETE 에는 그 문제가 없다 — 지우는 것뿐이라 내용을 바꿔치기할 수 없다.
-- 그래서 RPC 를 새로 만들지 않고 정책 한 줄로 연다(자기 행만).
--
-- 지우면 되살릴 수 없다. 알림은 받는 사람의 것이고, 운영자 쪽 '보낸 알림'은 묶음(batch)
-- 단위 발송 기록이라 회원이 지워도 발송 사실 자체가 사라지지는 않는다.
-- idempotent.

drop policy if exists member_notices_delete on band123.member_notices;
create policy member_notices_delete on band123.member_notices
  for delete using (user_id = auth.uid());
