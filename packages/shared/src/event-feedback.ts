// 행사 피드백 설문 문항 — 모든 행사가 같은 8단계를 쓴다.
//
// 왜 코드에 두나: 문항을 DB 로 빼면 행사마다 달라져 '작년보다 나아졌나'를 물을 수 없다.
// 같은 자로 재야 비교가 되므로 문항은 고정하고, 저장하는 건 답뿐이다(event_feedback.answers).
//
// 문구는 앱의 사전(dictionaries)에 두지 않는다 — 문항이 60개 가까이라 사전이 설문으로 뒤덮인다.
// 대신 여기에 ko/en 을 나란히 적는다. 화면은 locale 로 골라 쓴다.
//
// ⚠️ code 는 저장된 답의 열쇠다. 한번 나간 코드는 바꾸지 않는다 — 바꾸면 옛 응답이 미아가 된다.
//    문항을 더할 수는 있다(옛 응답에는 그 키가 없을 뿐).

export type FeedbackFieldType = 'text' | 'textarea' | 'rating' | 'single' | 'multi';

export interface FeedbackChoice {
  value: string;
  ko: string;
  en: string;
}

export interface FeedbackField {
  code: string;
  type: FeedbackFieldType;
  ko: string;
  en: string;
  /** 문항 아래 작은 설명 줄. */
  hintKo?: string;
  hintEn?: string;
  choices?: FeedbackChoice[];
}

export interface FeedbackSection {
  code: string;
  emoji: string;
  ko: string;
  en: string;
  fields: FeedbackField[];
}

const c = (value: string, ko: string, en: string): FeedbackChoice => ({ value, ko, en });

/** 별점 1~5 문항이 공유하는 척도. */
export const FEEDBACK_RATING_MAX = 5;

export const FEEDBACK_SECTIONS: FeedbackSection[] = [
  {
    code: 'about_you',
    emoji: '🙋',
    ko: '참가자 정보',
    en: 'About You',
    fields: [
      {
        code: 'name',
        type: 'text',
        ko: '이름',
        en: 'Name',
        hintKo: '비워 두시면 익명으로 접수됩니다',
        hintEn: 'Leave blank to stay anonymous',
      },
      {
        code: 'email',
        type: 'text',
        ko: '이메일',
        en: 'Email',
        hintKo: '답변을 듣고 싶으실 때만 적어 주세요',
        hintEn: "Only if you'd like us to follow up",
      },
      {
        code: 'dancer_level',
        type: 'single',
        ko: '본인을 가장 잘 나타내는 것은?',
        en: 'Which best describes you?',
        choices: [
          c('beginner', '입문', 'Beginner dancer'),
          c('intermediate', '중급', 'Intermediate'),
          c('advanced', '상급', 'Advanced'),
          c('instructor', '강사', 'Instructor'),
          c('first_festival', '페스티벌 첫 참가', 'First festival ever'),
          c('regular', '페스티벌 단골', 'Festival regular'),
        ],
      },
      {
        code: 'nights_attended',
        type: 'multi',
        ko: '어느 날 참석하셨나요?',
        en: 'Which days did you attend?',
        hintKo: '해당하는 것을 모두 고르세요',
        hintEn: 'Pick all that apply',
        choices: [
          c('welcome', '웰컴 파티', 'Welcome party'),
          c('pre', '프리 파티', 'Pre-party'),
          c('day1', '첫째 날', 'Day 1'),
          c('day2', '둘째 날', 'Day 2'),
          c('day3', '셋째 날', 'Day 3'),
          c('after', '애프터 파티', 'After-party'),
        ],
      },
    ],
  },
  {
    code: 'overall',
    emoji: '⭐',
    ko: '전반적인 경험',
    en: 'Overall Experience',
    fields: [
      { code: 'overall_rating', type: 'rating', ko: '행사 전반을 평가해 주세요', en: 'Overall, how would you rate the festival?' },
      {
        code: 'attend_again',
        type: 'single',
        ko: '다음에도 참가하시겠어요?',
        en: 'Would you attend this festival again?',
        choices: [
          c('definitely', '꼭 갈 거예요', 'Definitely'),
          c('probably', '아마도요', 'Probably'),
          c('not_sure', '잘 모르겠어요', 'Not sure'),
          c('probably_not', '아마 안 갈 것 같아요', 'Probably not'),
        ],
      },
      {
        code: 'recommend',
        type: 'single',
        ko: '친구에게 추천하시겠어요?',
        en: 'Would you recommend it to a friend?',
        choices: [
          c('definitely', '꼭 추천해요', 'Definitely'),
          c('probably', '아마도요', 'Probably'),
          c('not_sure', '잘 모르겠어요', 'Not sure'),
          c('probably_not', '아마 안 할 것 같아요', 'Probably not'),
        ],
      },
    ],
  },
  {
    code: 'artists',
    emoji: '💃',
    ko: '아티스트 · 강사',
    en: 'Artists & Instructors',
    fields: [
      { code: 'favorite_artists', type: 'textarea', ko: '이번에 가장 좋았던 아티스트·강사는 누구인가요?', en: 'Who were your favorite artists or instructors this festival?' },
      { code: 'invite_back', type: 'textarea', ko: '내년에 다시 보고 싶은 사람은 누구인가요?', en: 'Who would you most like to see invited back next year?' },
      {
        code: 'artist_mismatch',
        type: 'textarea',
        ko: '수업이나 스타일이 잘 맞지 않았던 분이 있었나요?',
        en: "Was there anyone whose class or style didn't work for you?",
        hintKo: '주최자만 봅니다. 공개되지 않습니다',
        hintEn: 'Only the organizer sees this. It is never published',
      },
      { code: 'lineup_rating', type: 'rating', ko: '아티스트 라인업 전반의 완성도', en: 'How would you rate the overall quality of the artist lineup?' },
      {
        code: 'local_international',
        type: 'single',
        ko: '로컬 아티스트와 해외 아티스트의 균형은 어땠나요?',
        en: 'How was the balance between local and international artists?',
        choices: [
          c('good', '적당했어요', 'Good balance'),
          c('more_local', '로컬 아티스트가 더 많으면 좋겠어요', 'Would like more local artists'),
          c('more_international', '해외 아티스트가 더 많으면 좋겠어요', 'Would like more international artists'),
          c('no_preference', '상관없어요', 'No preference'),
        ],
      },
      { code: 'artist_comments', type: 'textarea', ko: '아티스트·강사에 대해 더 하고 싶은 말', en: 'Any other comments about the artists/instructors?' },
    ],
  },
  {
    code: 'workshops',
    emoji: '📚',
    ko: '워크숍',
    en: 'Workshops',
    fields: [
      { code: 'workshop_rating', type: 'rating', ko: '워크숍 전반의 만족도', en: 'Quality of the workshops overall' },
      {
        code: 'workshop_count',
        type: 'single',
        ko: '워크숍 개수',
        en: 'Number of workshops offered',
        choices: [
          c('too_few', '너무 적었어요', 'Too few'),
          c('just_right', '적당했어요', 'Just right'),
          c('too_many', '너무 많았어요', 'Too many'),
        ],
      },
      {
        code: 'workshop_schedule',
        type: 'single',
        ko: '워크숍 시간표',
        en: 'Workshop scheduling / timing',
        choices: [
          c('worked_well', '괜찮았어요', 'Worked well'),
          c('too_early', '너무 일렀어요', 'Too early'),
          c('too_late', '너무 늦었어요', 'Too late'),
          c('too_packed', '너무 빡빡했어요', 'Too packed together'),
          c('too_spread', '너무 띄엄띄엄했어요', 'Too spread out'),
        ],
      },
      {
        code: 'style_balance',
        type: 'single',
        ko: '살사·바차타·키좀바·주크 등 장르 배분은 적절했나요?',
        en: 'Was the style balance across the genres fair?',
        choices: [
          c('balanced', '적절했어요', 'Yes, well balanced'),
          c('too_bachata', '바차타가 너무 많았어요', 'Too Bachata-heavy'),
          c('too_salsa', '살사가 너무 많았어요', 'Too Salsa-heavy'),
          c('more_kizomba', '키좀바가 부족했어요', 'Not enough Kizomba'),
          c('more_zouk', '주크가 부족했어요', 'Not enough Zouk'),
        ],
      },
      { code: 'workshop_comments', type: 'textarea', ko: '워크숍에 대해 더 하고 싶은 말', en: 'Workshop comments' },
    ],
  },
  {
    code: 'social',
    emoji: '🕺',
    ko: '소셜 댄스 · 플로어',
    en: 'Social Dancing & Rooms',
    fields: [
      {
        code: 'social_time',
        type: 'single',
        ko: '소셜 댄스 시간',
        en: 'Amount of social dancing time',
        choices: [
          c('too_little', '너무 짧았어요', 'Too little'),
          c('just_right', '적당했어요', 'Just right'),
          c('too_much', '너무 길었어요', 'Too much'),
        ],
      },
      {
        code: 'room_setup',
        type: 'single',
        ko: '플로어(룸) 운영은 어땠나요?',
        en: 'How did the room setup work for you?',
        choices: [
          c('great', '아주 좋았어요', 'Worked great'),
          c('okay', '괜찮지만 개선 여지가 있어요', 'Okay but could be improved'),
          c('not_working', '잘 맞지 않았어요', "Didn't work for me"),
        ],
      },
      {
        code: 'music_balance',
        type: 'single',
        ko: '장르별 음악 배분은 어땠나요?',
        en: 'How was the balance of music across the styles?',
        choices: [
          c('balanced', '적절했어요', 'Well balanced'),
          c('too_bachata', '바차타가 너무 많았어요', 'Too much Bachata'),
          c('too_salsa', '살사가 너무 많았어요', 'Too much Salsa'),
          c('more_kizomba', '키좀바가 부족했어요', 'Not enough Kizomba'),
          c('more_zouk', '주크가 부족했어요', 'Not enough Zouk'),
        ],
      },
      { code: 'dj_rating', type: 'rating', ko: 'DJ 만족도', en: 'DJ quality' },
      { code: 'favorite_djs', type: 'textarea', ko: '특히 좋았던 DJ가 있나요?', en: 'Any DJs you especially enjoyed?' },
      { code: 'sound_rating', type: 'rating', ko: '음향 만족도', en: 'Sound quality' },
      { code: 'social_comments', type: 'textarea', ko: '소셜 댄스에 대해 더 하고 싶은 말', en: 'Social dancing comments' },
    ],
  },
  {
    code: 'shows',
    emoji: '🏆',
    ko: '공연 · 잭앤질',
    en: 'Performances & Jack & Jill',
    fields: [
      {
        code: 'performances',
        type: 'single',
        ko: '공연(쇼케이스)은 어떠셨나요?',
        en: 'How did you feel about the performance showcases?',
        choices: [
          c('loved', '아주 좋았어요', 'Loved them'),
          c('fine', '괜찮았어요', 'They were fine'),
          c('too_long', '너무 길었어요', 'Too long'),
          c('took_social_time', '소셜 시간을 너무 뺏었어요', 'Took too much time away from social dancing'),
          c('did_not_watch', '보지 않았어요', "Didn't watch them"),
        ],
      },
      {
        code: 'jnj',
        type: 'single',
        ko: '잭앤질 대회는 어떠셨나요?',
        en: 'How did you feel about the Jack & Jill competition?',
        choices: [
          c('loved', '아주 좋았어요', 'Loved it'),
          c('fine', '괜찮았어요', 'It was fine'),
          c('not_interested', '관심 없었어요', 'Not interested'),
          c('took_social_time', '소셜 시간을 너무 뺏었어요', 'Took too much time from social dancing'),
        ],
      },
      {
        code: 'jnj_slot',
        type: 'single',
        ko: '잭앤질에 가장 좋은 시간대는?',
        en: "What's the best time slot for Jack & Jill?",
        choices: [
          c('afternoon', '낮', 'Afternoon'),
          c('early_evening', '초저녁(7~8시경)', 'Early evening (around 7–8 PM)'),
          c('late_night', '늦은 밤', 'Later at night'),
          c('keep', '지금 그대로', 'Keep it as it was'),
          c('no_preference', '상관없어요', 'No preference'),
        ],
      },
      { code: 'show_comments', type: 'textarea', ko: '공연·대회에 대해 더 하고 싶은 말', en: 'Performance & competition comments' },
    ],
  },
  {
    code: 'venue',
    emoji: '🏟️',
    ko: '장소 · 운영',
    en: 'Venue & Organization',
    fields: [
      { code: 'venue_rating', type: 'rating', ko: '장소·위치', en: 'Venue / location' },
      { code: 'floor_rating', type: 'rating', ko: '바닥(플로어) 상태', en: 'Floor quality for dancing' },
      { code: 'organization_rating', type: 'rating', ko: '운영과 안내', en: 'Organization and communication from the team' },
      {
        code: 'schedule_flow',
        type: 'single',
        ko: '전체 일정의 흐름은 어땠나요?',
        en: 'How was the overall event schedule / flow?',
        choices: [
          c('great', '아주 좋았어요', 'Great'),
          c('good_packed', '좋았지만 조금 빡빡했어요', 'Good but a bit packed'),
          c('too_packed', '너무 빡빡했어요', 'Too packed'),
          c('too_much_downtime', '비는 시간이 많았어요', 'Too much downtime'),
        ],
      },
      { code: 'value_rating', type: 'rating', ko: '가격 대비 만족도', en: 'Value for money' },
      { code: 'venue_comments', type: 'textarea', ko: '장소·운영에 대해 더 하고 싶은 말', en: 'Venue & organization comments' },
    ],
  },
  {
    code: 'anything_else',
    emoji: '💬',
    ko: '마지막으로',
    en: 'Anything Else',
    fields: [
      { code: 'anything_else', type: 'textarea', ko: '저희가 묻지 않은 것 중 하고 싶은 말이 있다면?', en: "Anything we didn't ask about? Tell us here" },
      { code: 'one_change', type: 'textarea', ko: '내년에 딱 하나만 바꾼다면 무엇일까요?', en: "What's the ONE thing we should change for next year?" },
    ],
  },
];

/** 설문 응답에서 이름·이메일로 따로 빼 두는 문항 코드 — 목록에서 바로 보여 주기 위해서다. */
export const FEEDBACK_NAME_CODE = 'name';
export const FEEDBACK_EMAIL_CODE = 'email';

/** code → 문항. 파트너 화면이 저장된 답을 문구로 되돌릴 때 쓴다. */
export const FEEDBACK_FIELDS: Record<string, FeedbackField> = Object.fromEntries(
  FEEDBACK_SECTIONS.flatMap((s) => s.fields).map((f) => [f.code, f]),
);

/** 저장된 답 한 개를 사람이 읽는 문자열로. 선택지는 코드가 아니라 문구로 되돌린다. */
export function feedbackAnswerText(code: string, value: unknown, locale: 'ko' | 'en'): string {
  const field = FEEDBACK_FIELDS[code];
  if (value == null || value === '') return '';
  if (!field) return String(value);
  if (field.type === 'rating') return `${value} / ${FEEDBACK_RATING_MAX}`;
  const label = (v: unknown) => {
    const choice = field.choices?.find((ch) => ch.value === v);
    return choice ? choice[locale] : String(v);
  };
  return Array.isArray(value) ? value.map(label).join(', ') : label(value);
}
