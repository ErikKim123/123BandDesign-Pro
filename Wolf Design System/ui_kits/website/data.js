// Wolf website — shared sample data + tiny helpers (window globals)
const WOLF_FESTIVALS = [
  {
    id: "sunset-wave",
    name: "선셋 웨이브",
    en: "SUNSET WAVE",
    genre: "EDM",
    date: "2026.07.31 – 08.02",
    short: "07.31",
    location: "부산 다대포 해변",
    from: 120000,
    sky: "linear-gradient(150deg,#ff8a00,#fa520f 55%,#cc3a05)",
    tag: "얼리버드",
    lineup: ["ALOK", "Peggy Gou", "Yaeji", "250", "Hyukoh", "PALMS"],
    blurb: "해변 위로 해가 지면, 베이스가 차오른다. 3일간의 일렉트로닉 항해.",
  },
  {
    id: "golden-hour",
    name: "골든 아워",
    en: "GOLDEN HOUR",
    genre: "인디",
    date: "2026.09.12 – 09.13",
    short: "09.12",
    location: "서울 난지한강공원",
    from: 95000,
    sky: "linear-gradient(150deg,#ffb83e,#ff8105 60%,#fa520f)",
    tag: "라인업 공개",
    lineup: ["검정치마", "새소년", "잔나비", "실리카겔", "ADOY", "웬디"],
    blurb: "노을과 함께 흐르는 인디 사운드. 가장 따뜻한 가을의 하루.",
  },
  {
    id: "midnight-howl",
    name: "미드나잇 하울",
    en: "MIDNIGHT HOWL",
    genre: "힙합",
    date: "2026.08.22 – 08.23",
    short: "08.22",
    location: "인천 영종도 스카이파크",
    from: 110000,
    sky: "linear-gradient(150deg,#ffd06a,#ffa110 55%,#ff8105)",
    tag: "매진 임박",
    lineup: ["사이먼 도미닉", "이영지", "비오", "Crush", "주석", "릴러말즈"],
    blurb: "달이 뜨면 늑대가 운다. 밤을 새우는 힙합 라인업.",
  },
  {
    id: "amber-fields",
    name: "앰버 필즈",
    en: "AMBER FIELDS",
    genre: "록",
    date: "2026.10.03 – 10.04",
    short: "10.03",
    location: "경기 가평 자라섬",
    from: 105000,
    sky: "linear-gradient(150deg,#ffd900,#ffb83e 55%,#ff8a00)",
    tag: "",
    lineup: ["넬", "잔나비", "데이식스", "쏜애플", "터치드", "QWER"],
    blurb: "황금빛 들판에서 울리는 기타. 가을 록 페스티벌의 정점.",
  },
];

const WOLF_PASSES = [
  {
    id: "1day", name: "1-DAY PASS", mult: 1, cadence: "/ 1일권", featured: false,
    desc: "하루를 가장 가볍게", badge: "",
    perks: ["선택한 1일 입장", "스탠딩 구역", "앱 디지털 패스"],
  },
  {
    id: "3day", name: "3-DAY PASS", mult: 2.4, cadence: "/ 3일권", featured: true,
    desc: "가장 인기 있는 선택", badge: "BEST VALUE",
    perks: ["3일 전체 입장", "전용 라운지 이용", "한정 굿즈 키트", "재입장 무제한"],
  },
  {
    id: "vip", name: "VIP PASS", mult: 4.9, cadence: "/ 3일권", featured: false,
    desc: "무대 앞, 모든 것", badge: "",
    perks: ["VIP 스탠딩 구역", "백스테이지 투어", "웰컴 드링크 & 발렛", "전용 입장 게이트"],
  },
];

function wolfWon(n) {
  return "₩" + n.toLocaleString("ko-KR");
}

Object.assign(window, { WOLF_FESTIVALS, WOLF_PASSES, wolfWon });
