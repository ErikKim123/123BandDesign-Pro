// 0089 발송 기록의 RLS 가 의도대로 동작하는지 실데이터로 확인.
// 판매자는 자기 주문만, 구매자는 자기 주문만, 남은 아무것도 못 본다.
//
// 주의: 하나의 트랜잭션 안에서 SAVEPOINT 로 역할을 바꿔 가며 본다.
//   중첩 begin 은 경고만 내고 무시되고, 그 안의 rollback 이 바깥 트랜잭션까지 끝내 버린다
//   (그래서 먼저 심어 둔 검증용 행이 사라져 '구매자가 못 본다'는 거짓 실패가 났었다).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
for (const line of existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8').split('\n') : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
// 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
await c.query('set search_path = band123, extensions');

const { rows: cand } = await c.query(`
  select o.id, o.order_no, o.buyer_id, oi.seller_id
  from orders o join order_items oi on oi.order_id = o.id
  where o.status in ('paid','shipped','done') order by o.paid_at desc nulls last limit 1`);
if (!cand.length) { console.log('결제완료 주문이 없어 건너뜀'); await c.end(); process.exit(0); }
const { id, order_no, buyer_id, seller_id } = cand[0];
const stranger = randomUUID(); // 이 주문과 아무 관계 없는 사람
console.log(`대상 주문 : ${order_no}`);
console.log(`  판매자  : ${seller_id}`);
console.log(`  구매자  : ${buyer_id}`);
console.log(`  제3자   : ${stranger}`);

let fail = 0;
let sp = 0;

/** 한 사용자로 가장해 fn 을 돌리고, 끝나면 그 안의 변경을 세이브포인트로 되돌린다. */
async function asUser(uid, fn) {
  const name = `sp${++sp}`;
  await c.query(`savepoint ${name}`);
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  await c.query('set local role authenticated');
  try {
    return await fn();
  } finally {
    await c.query(`rollback to savepoint ${name}`);
    await c.query('reset role');
  }
}

await c.query('begin');
// 검증용 행을 서비스롤로 심는다 — 마지막에 통째로 롤백한다.
await c.query(
  `insert into order_mail_log (order_id, kind, locale, to_email, sent_by)
   values ($1,'order_confirmation','en','probe@example.com',null)`, [id]);

console.log('\n== SELECT — 누가 이 기록을 볼 수 있나');
for (const [uid, label, expect] of [
  [seller_id, '판매자 본인', 1],
  [buyer_id, '구매자 본인', 1],
  [stranger, '제3자', 0],
]) {
  const n = await asUser(uid, async () => {
    const { rows } = await c.query('select count(*)::int as n from order_mail_log where order_id = $1', [id]);
    return rows[0].n;
  });
  const ok = n === expect;
  if (!ok) fail++;
  console.log(`  ${ok ? 'OK' : 'X '} ${label.padEnd(12)} 보이는 기록 ${n}건 (기대 ${expect})`);
}

console.log('\n== INSERT — 누가 기록을 남길 수 있나');
for (const [uid, label, shouldPass] of [
  [seller_id, '판매자 본인', true],
  [stranger, '제3자', false],
]) {
  const passed = await asUser(uid, async () => {
    try {
      await c.query(
        `insert into order_mail_log (order_id, kind, locale, to_email, sent_by)
         values ($1,'order_confirmation','ko','x@y.com',null)`, [id]);
      return true;
    } catch {
      return false;
    }
  });
  const ok = passed === shouldPass;
  if (!ok) fail++;
  console.log(`  ${ok ? 'OK' : 'X '} ${label.padEnd(12)} 쓰기 ${passed ? '통과' : '거부'} (기대 ${shouldPass ? '통과' : '거부'})`);
}

await c.query('rollback');
const { rows: left } = await c.query('select count(*)::int as n from order_mail_log');
console.log(`\n남은 기록 ${left[0].n}건 — 검증 데이터는 롤백됨`);
console.log(fail ? `실패 ${fail}건` : '전부 통과');
await c.end();
process.exit(fail ? 1 : 0);
