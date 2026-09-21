// 유튜브 영상 ID 파서 단위 테스트.
// 실행: pnpm test  (Node 24 의 내장 러너 + 타입 스트리핑 — 추가 의존성 없음)
//
// 이 파서가 틀리면 엉뚱한 영상이 라이브로 걸린다. 관리자가 복사해 올 만한 주소를 전부 세워 둔다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeVideoId } from '../src/media.ts';

const ID = 'dQw4w9WgXcQ'; // 11자 샘플

test('명세의 네 가지 주소 형식에서 ID 를 뽑는다', () => {
  assert.equal(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}`), ID);
  assert.equal(youtubeVideoId(`https://youtu.be/${ID}`), ID);
  assert.equal(youtubeVideoId(`https://www.youtube.com/live/${ID}`), ID);
  assert.equal(youtubeVideoId(`https://studio.youtube.com/video/${ID}/livestreaming`), ID);
});

test('ID 11자를 직접 입력해도 그대로 받는다', () => {
  assert.equal(youtubeVideoId(ID), ID);
  assert.equal(youtubeVideoId(`  ${ID}  `), ID); // 앞뒤 공백은 흘려보낸다
});

test('현장에서 실제로 붙여넣는 변형들', () => {
  // 재생 위치·재생목록·추적 파라미터가 붙은 주소
  assert.equal(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s`), ID);
  assert.equal(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}&list=PL123`), ID);
  assert.equal(youtubeVideoId(`https://youtu.be/${ID}?si=abcdEFGH`), ID);
  // 파라미터 순서가 뒤바뀐 주소(모바일에서 공유하면 이렇게 나온다)
  assert.equal(youtubeVideoId(`https://www.youtube.com/watch?app=desktop&v=${ID}`), ID);
  // 스킴 없는 주소
  assert.equal(youtubeVideoId(`youtu.be/${ID}`), ID);
  assert.equal(youtubeVideoId(`www.youtube.com/watch?v=${ID}`), ID);
  // 임베드·쇼츠·nocookie
  assert.equal(youtubeVideoId(`https://www.youtube.com/embed/${ID}`), ID);
  assert.equal(youtubeVideoId(`https://www.youtube.com/shorts/${ID}`), ID);
  assert.equal(youtubeVideoId(`https://www.youtube-nocookie.com/embed/${ID}`), ID);
  // 스튜디오 편집 화면 주소(끝이 /edit 인 경우)
  assert.equal(youtubeVideoId(`https://studio.youtube.com/video/${ID}/edit`), ID);
});

test('유튜브가 아니거나 형식이 틀리면 null 을 준다', () => {
  assert.equal(youtubeVideoId(''), null);
  assert.equal(youtubeVideoId(null), null);
  assert.equal(youtubeVideoId(undefined), null);
  assert.equal(youtubeVideoId('그냥 텍스트'), null);
  assert.equal(youtubeVideoId('https://vimeo.com/76979871'), null);
  assert.equal(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null); // 남의 도메인
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=short'), null); // 11자 미만
  assert.equal(youtubeVideoId('https://www.youtube.com/@channel'), null); // 채널 주소
  assert.equal(youtubeVideoId('dQw4w9WgXc'), null); // 10자
  assert.equal(youtubeVideoId('dQw4w9WgXcQ!'), null); // 허용되지 않는 문자
});

test('ID 에 하이픈·밑줄이 들어가도 온전히 나온다', () => {
  const tricky = 'a_b-c_d-e_f';
  assert.equal(tricky.length, 11);
  assert.equal(youtubeVideoId(`https://youtu.be/${tricky}`), tricky);
  assert.equal(youtubeVideoId(tricky), tricky);
});
