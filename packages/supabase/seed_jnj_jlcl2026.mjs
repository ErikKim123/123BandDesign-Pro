// JLCL 2026 J&J 에디션의 FORMAT / GUIDELINES 본문 시드.
// 출처: bachatasocialworldcup.com/guidelines (Notion 기반 공개 문서)의 구성과 내용을 그대로 옮기되,
//       BSWC 고유 정보(주최명·2025년 3월 30일 등 특정 일자)는 본 대회 기준으로 중립화했다.
//       실제 진행 시간표·심사 시스템명은 어드민 > J&J 대회관리에서 확정값으로 바꾸면 된다.
// 사용: node seed_jnj_jlcl2026.mjs   (루트 .env 의 DATABASE_URL)
// idempotent — 다시 실행하면 본문을 이 내용으로 덮어쓴다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let [, k, v] = m;
    v = v.replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

// ── FORMAT — 대회가 어떻게 굴러가는지 ────────────────────────────
const FORMAT_EN = `## Introduction

Social dance competitions are a mix of luck and skill. Skill is demonstrated by meeting the competition criteria. Luck comes into play in terms of the randomness of who you are paired with, when the judges are observing you compared to others, and the songs accompanying your dance.

- Randomness is one of the factors of social dance competitions. Preliminary groups are created randomly, and inside your group you will be rotating partners.
- Judging criteria: judges will evaluate participants based on established judging criteria.
- Music: music is completely random.

## Event Schedule

### Warm-Up Session

- Time: 17:00 – 17:45
- Open to all registered dancers.

### Official Opening

- Time: 17:45
- Anthem performance and ceremonial flag presentation, celebrating unity through dance.

### Competition Rounds

- Preliminary: 18:00 – 19:45
- Quarter-Finals: 20:00 – 20:30
- Semi-Finals: 20:30 – 21:00
- Finals: 22:00 – 22:30

### Announcement of Results

- Results will be announced and displayed immediately after each round, following short breaks.

### Prize Ceremony

- Time: 22:30 – 22:45
- Prizes are awarded to finalists and winners.

## Scoring System

The competition uses a real-time scoring system to ensure transparency and rapid result dissemination. Each judge has a minimum of 50 seconds per dancer for evaluation.

### Preliminary & Quarter-Finals

- Judges evaluate separately: leaders judge leaders, followers judge followers.

### Semi-Finals

- Judges will evaluate both roles.
- Judges may be seated at a table outside the circle for improved observation.

### Finals

- Judges will evaluate finalists both from an external perspective and through direct dance interactions.
- Judges may be seated at a table outside the circle for improved observation.
- Additionally, finalists will cast votes for the dancers they have partnered with — leaders voting for followers, and followers voting for leaders.

## Music

To preserve spontaneity, songs will not be shared with participants in advance. The music will reflect the rich diversity typically found at socials. You can expect a balanced mix approximately as follows:

- 70% Modern Bachata — 40% recent hits (2024–2025), 15% intermediate hits (2015–2023), 15% classics (before 2015)
- 10% Bachata Covers
- 10% Traditional Bachata
- 10% Bachata Urban

## Judging Criteria

In our social dance competition, the evaluation emphasizes the essence of true social dancing. Judges will focus on:

- **Technique**: precision and mastery of movements.
- **Musicality**: ability to interpret and stay in sync with the music.
- **Connection**: quality of partner communication and responsiveness.
- **Creativity & Style**: unique expression and personal flair.
- **Attitude**: confidence, joy, and positive energy on the dance floor.

While both Jack & Jills and social dance competitions celebrate social dancing, social dance competitions place higher value on connection — especially because in the finals, judges often dance with participants. This dynamic highlights the importance of leading and following skills and the ability to adapt in real time, which may be less emphasized in Jack & Jill competitions, where performance and showmanship can sometimes take a bigger role.`;

const FORMAT_KO = `## 대회 소개

소셜 댄스 대회는 운과 실력이 함께 작용합니다. 실력은 심사 기준을 충족하는 것으로 증명되고, 운은 누구와 짝이 되는지, 심사위원이 언제 나를 보는지, 어떤 곡에 춤추게 되는지의 무작위성에서 나옵니다.

- 무작위성은 소셜 댄스 대회의 핵심 요소입니다. 예선 조는 무작위로 편성되며, 조 안에서는 파트너를 로테이션합니다.
- 심사 기준: 심사위원은 사전에 정해진 심사 기준에 따라 참가자를 평가합니다.
- 음악: 음악은 완전히 무작위로 선곡됩니다.

## 진행 일정

### 워밍업 세션

- 시간: 17:00 – 17:45
- 등록한 모든 참가자에게 개방됩니다.

### 공식 개회

- 시간: 17:45
- 개회 공연과 국기 입장 세리머니로, 춤으로 하나 되는 자리를 엽니다.

### 경기 라운드

- 예선: 18:00 – 19:45
- 8강: 20:00 – 20:30
- 준결승: 20:30 – 21:00
- 결승: 22:00 – 22:30

### 결과 발표

- 각 라운드가 끝나면 짧은 휴식 후 즉시 결과를 발표·게시합니다.

### 시상식

- 시간: 22:30 – 22:45
- 결승 진출자와 우승자에게 시상합니다.

## 채점 방식

투명성과 신속한 결과 공개를 위해 실시간 채점 시스템을 사용합니다. 심사위원 1인당 참가자 1명을 최소 50초 이상 관찰하고 평가합니다.

### 예선 · 8강

- 역할별로 나누어 심사합니다. 리더는 리더를, 팔로워는 팔로워를 심사합니다.

### 준결승

- 심사위원이 두 역할을 모두 평가합니다.
- 더 정확한 관찰을 위해 심사위원이 서클 바깥 테이블에 앉을 수 있습니다.

### 결승

- 심사위원은 바깥에서 관찰하는 동시에, 직접 함께 춤추며 결승 진출자를 평가합니다.
- 더 정확한 관찰을 위해 심사위원이 서클 바깥 테이블에 앉을 수 있습니다.
- 추가로, 결승 진출자끼리도 함께 춤춘 상대에게 투표합니다 — 리더는 팔로워에게, 팔로워는 리더에게 투표합니다.

## 음악

즉흥성을 지키기 위해 곡은 사전에 공개하지 않습니다. 실제 소셜 현장에서 들을 법한 다양한 선곡으로 구성되며, 대략 다음 비율로 균형을 맞춥니다.

- 모던 바차타 70% — 최신곡(2024–2025) 40%, 중간 시기(2015–2023) 15%, 클래식(2015년 이전) 15%
- 바차타 커버 10%
- 트래디셔널 바차타 10%
- 바차타 어반 10%

## 심사 기준

본 대회의 평가는 '진짜 소셜 댄스'의 본질에 초점을 맞춥니다. 심사위원은 다음을 봅니다.

- **테크닉**: 동작의 정확성과 완성도.
- **뮤지컬리티**: 음악을 해석하고 박자에 실어내는 능력.
- **커넥션**: 파트너와의 소통과 반응의 질.
- **창의성 · 스타일**: 자기만의 표현과 개성.
- **애티튜드**: 플로어 위에서의 자신감, 즐거움, 긍정적인 에너지.

잭앤질과 소셜 댄스 대회 모두 소셜 댄스를 기린다는 점은 같지만, 소셜 댄스 대회는 커넥션에 더 큰 비중을 둡니다. 결승에서는 심사위원이 직접 참가자와 춤추는 경우가 많기 때문입니다. 그만큼 리드·팔로우 능력과 즉석에서 맞춰가는 적응력이 중요해지며, 퍼포먼스와 쇼맨십의 비중이 상대적으로 큰 잭앤질과는 이 지점에서 결이 다릅니다.`;

// ── GUIDELINES — 참가자가 지켜야 할 것 ───────────────────────────
const GUIDELINES_EN = `## Participant Rules

### Dorsal Pickup

- Dorsals must be collected between 13:00 and 16:00 on the competition day.
- Waitlisted dancers wishing to compete must be present by 16:00.
- Late dorsal pickups result in disqualification, with vacancies filled sequentially from the waitlist based on ranking.

### Dorsal Visibility

- Participants must visibly wear their dorsal number throughout all competition stages.

### Acrobatics

- Permitted: dips (one partner maintains contact with the floor).
- Prohibited: lifts or any movement resulting in both feet of one dancer leaving the ground simultaneously.

### Dress Code

- Stylish and social-dance friendly. Express yourself while staying comfortable on the dance floor.

### Code of Conduct

- Treat all participants, judges, and staff with kindness and respect, on and off the dance floor.
- Any form of harassment, discrimination, or intimidation will not be tolerated.
- Celebrate others' dancing and contribute to a positive, inclusive atmosphere.

## Judges

### Feedback Opportunities

- Personalized feedback from judges will be available after the competition (subject to each judge's availability).

### Conflict of Interest Policy

- Judges are not permitted to evaluate their current dance partners, romantic partners, or immediate family members.
- Judges must formally declare that they will remain impartial, even in cases of a conflict of interest — defined as any potential personal benefit, whether direct, indirect, real, or perceived.
- Judges will remain neutral, even when evaluating friends, students, teammates, or instructors, in order to avoid bias.`;

const GUIDELINES_KO = `## 참가자 규정

### 배번호(도살) 수령

- 배번호는 대회 당일 13:00–16:00 사이에 수령해야 합니다.
- 대기자 명단에 있는 참가자가 출전을 원할 경우 16:00까지 현장에 있어야 합니다.
- 시간 내에 수령하지 않으면 실격 처리되며, 생긴 자리는 대기 순번에 따라 순차로 채워집니다.

### 배번호 착용

- 참가자는 모든 라운드 동안 배번호가 보이도록 착용해야 합니다.

### 아크로바틱

- 허용: 딥(한 사람은 바닥과 접촉을 유지하는 동작).
- 금지: 리프트, 또는 한 사람의 두 발이 동시에 바닥에서 떨어지는 모든 동작.

### 드레스 코드

- 멋스럽되 소셜 댄스에 적합한 복장. 플로어에서 편안함을 유지하면서 자신을 표현하세요.

### 행동 규범

- 플로어 안팎을 가리지 않고 모든 참가자·심사위원·스태프를 존중하고 배려해 주세요.
- 어떤 형태의 괴롭힘, 차별, 위협도 용납되지 않습니다.
- 다른 사람의 춤을 함께 기뻐하고, 긍정적이고 포용적인 분위기를 만들어 주세요.

## 심사위원

### 피드백

- 대회 종료 후 심사위원 개별 피드백을 받을 수 있습니다(심사위원별 가능 여부에 따름).

### 이해상충 정책

- 심사위원은 현재의 댄스 파트너, 연인, 직계 가족을 평가할 수 없습니다.
- 심사위원은 이해상충(직간접적·실제적·외견상의 개인적 이익 가능성)이 있는 경우에도 공정성을 유지하겠다는 서약을 해야 합니다.
- 친구, 수강생, 팀원, 강사를 평가할 때에도 편향 없이 중립을 지켜야 합니다.`;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
// 울프·JNJ(public)와 같은 DB — 123Band 테이블(band123)만 보도록 public 을 뺀다
await client.query('set search_path = band123, extensions');

const res = await client.query(
  `update jnj_editions
      set format_i18n     = jsonb_build_object('en', $2::text, 'ko', $3::text),
          guidelines_i18n = jsonb_build_object('en', $4::text, 'ko', $5::text)
    where slug = $1
    returning id, slug`,
  ['jlcl-2026', FORMAT_EN, FORMAT_KO, GUIDELINES_EN, GUIDELINES_KO],
);

if (res.rowCount === 0) {
  console.error('✗ jlcl-2026 에디션을 찾지 못했습니다. apply_jnj.mjs 를 먼저 실행하세요.');
  process.exitCode = 1;
} else {
  console.log(`✓ ${res.rows[0].slug} — FORMAT / GUIDELINES 본문 반영 (EN·KO)`);
}

await client.end();
