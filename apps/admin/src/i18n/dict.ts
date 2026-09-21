// Design Ref: 어드민 UI 다국어(EN/KO). 쿠키 admin_locale 로 전환.
// 확장: 페이지/리소스 라벨은 점진적으로 키 추가.
export const ADMIN_LOCALES = ['ko', 'en'] as const;
export type AdminLocale = (typeof ADMIN_LOCALES)[number];
export const DEFAULT_ADMIN_LOCALE: AdminLocale = 'ko';

export function isAdminLocale(v: unknown): v is AdminLocale {
  return v === 'ko' || v === 'en';
}

/** "총 {n}건" 같은 단순 치환 */
export function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

type Dict = {
  appName: string;
  logout: string;
  openMenu: string;
  close: string;
  nav: Record<string, string>; // href 슬러그 → 라벨
  common: {
    add: string;
    allSuffix: string; // "상태: 전체" 의 '전체'
    select: string;
    copy: string;
    delete: string;
    preview: string;
    previewTitle: string;
    duplicateAsDraft: string;
    deleteConfirm: string; // {name}
  };
  table: { total: string; loading: string; empty: string; selected: string };
  form: {
    save: string;
    saving: string;
    cancel: string;
    requiredField: string; // {label}
    jsonInvalid: string;
    jsonInvalidShort: string;
    inputField: string;
    inputLanguage: string;
    validationFailed: string;
    saveFailed: string;
    i18nFallbackHint: string;
    i18nMirrorHint: (from: string) => string; // 반대 언어 입력을 그대로 복사한 값
    i18nFallbackFrom: (from: string) => string; // 비워두면 반대 언어 값이 노출
  };
  categories: {
    title: string;
    drawerEdit: string;
    drawerCreate: string;
    empty: string;
    hidden: string;
    topLevel: string;
    field: { code: string; name: string; parent: string; sortOrder: string; visible: string };
  };
  imageField: {
    uploading: string;
    change: string;
    upload: string;
    remove: string;
    hint: string;
    onlyImages: string;
    maxSize: string;
    uploadFailed: string;
    previewAlt: string;
  };
  linksField: {
    add: string;
    remove: string;
    moveUp: string;
    moveDown: string;
    placeholder: string;
    notPlayable: string;
    maxHint: string;
    maxReached: string;
  };
  aiEditor: {
    title: string;
    aiDraft: string;
    panelHint: string;
    keywordsPh: string;
    featuresPh: string;
    imageUrlsPh: string;
    generateEn: string;
    enterNameFirst: string;
    writeEnFirst: string;
    genFailed: string;
    transFailed: string;
    translateLabel: string; // {lang}
    preview: string; // {lang}
    fullPreview: string;
    previewEmpty: string;
    detailPreview: string; // {lang}
    editorPlaceholder: string;
    snip: { heading: string; paragraph: string; list: string; image: string };
  };
  eventEditor: {
    title: string;
    loading: string;
    onlyTicket: string;
    addUrl: string;
    delete: string;
    mediaTitle: string;
    mediaHint: string;
    mediaUrlPh: string;
    sectionsHint: string;
    sectionLabel: string; // {name}
    field: {
      banner: string;
      badge: string;
      subtitle: string;
      location: string;
      priceText: string;
      startAt: string;
      endAt: string;
      applyStart: string;
      applyEnd: string;
    };
    section: { about: string; inclusions: string; venue: string; notice: string; contact: string; channel: string; recommend: string; refund: string };
  };
  country: { label: string; placeholder: string; search: string; clear: string; noResults: string };
  seller: { partner: string; own: string };
  status: Record<string, string>; // 상태코드 → 라벨
  transitions: Record<string, string>; // 전이 labelKey → 라벨
  // 목록 액션(아이콘 버튼) 툴팁/확인 — 오거나이저·회원 공용
  actions: {
    approve: string;
    reject: string;
    suspend: string;
    restore: string;
    ban: string;
    unban: string;
    delete: string;
    confirmBan: string;
    confirmDelete: string; // {name}
    banned: string;
    unbanned: string;
    failed: string;
    // 주문 전이
    orderPaid: string;
    orderCancel: string;
    orderShip: string;
    orderRefund: string;
    orderDone: string;
    // 상품 행 액션
    fallbackProduct: string;
    confirmDeleteProduct: string; // {name}
  };
  eventPasses: {
    title: string;
    drawerEdit: string;
    drawerCreate: string;
    searchPlaceholder: string;
    fallbackName: string;
    deleteConfirm: string; // {name}
    duplicateTitle: string;
    col: { name: string; sellerAccount: string; seller: string; price: string; status: string; actions: string };
    field: {
      name_i18n: string;
      image_url: string;
      category_id: string;
      prices: string;
      attributes: string;
      detail_html_i18n: string;
      event_content: string;
      status: string;
    };
  };
  settings: {
    title: string;
    intro: string;
    snsTitle: string;
    instagram: string;
    instagramDesc: string;
    igHandle: string;
    igHandlePh: string;
    igToken: string;
    igTokenPh: string;
    showToken: string;
    hideToken: string;
    tokenSaved: string; // 저장된 토큰이 있어 입력칸을 비워도 유지됨을 안내
    connected: string;
    tokenValidUntil: (date: string, days: number) => string; // 만료일 + 남은 일수
    tokenAutoRenew: string; // 만료 전 자동 갱신됨을 안내
    tokenExpiringSoon: string; // 만료 임박 경고
    tokenExpired: string; // 이미 만료됨
    tokenNoExpiry: string; // 만료 정보 없음(장기 토큰 교환 안 됨)
    // 결제 › Wise 송금 링크
    paymentsTitle: string;
    wise: string;
    wiseDesc: string;
    wiseUrl: string;
    wiseUrlPh: string;
    wiseEnabled: string;
    wiseEnabledHint: string;
    // 알림 › 운영자 메일 수신자
    notifyTitle: string;
    notifyEmails: string;
    notifyEmailsDesc: string;
    notifyEmailPh: (n: number) => string;
    notifyEmailsEmpty: string;
    save: string;
    saving: string;
    saved: string;
    saveFailed: string;
    loading: string;
  };
  instagram: {
    title: string;
    intro: string;
    notConnected: string; // 계정 미연결 안내
    goToSettings: string;
    connectedAs: (handle: string) => string;
    // 캘린더
    today: string;
    prevMonth: string;
    nextMonth: string;
    weekdays: string[]; // 일~토 (7개)
    addOnDay: string; // 빈 날짜 클릭 안내
    morePosts: (n: number) => string;
    // 상태
    statusScheduled: string;
    statusPublishing: string;
    statusPosted: string;
    statusFailed: string;
    statusCanceled: string;
    // 작성 패널
    newPost: string;
    editPost: string;
    when: string;
    mediaKind: string;
    kindImage: string;
    kindVideo: string;
    videoHint: string; // 릴스로 게시된다는 안내
    source: string;
    sourceUpload: string;
    sourceUrl: string;
    upload: string;
    uploading: string;
    mediaUrlPh: string;
    coverUrl: string;
    coverUrlPh: string;
    caption: string;
    captionPh: string;
    captionCount: (n: number, max: number) => string;
    previewTitle: string;
    previewEmpty: string;
    schedule: string;
    scheduleSaving: string;
    postNow: string;
    posting: string;
    deletePost: string;
    deleteConfirm: string;
    openPost: string; // 게시된 인스타 링크 열기
    cancel: string;
    // 결과/오류
    scheduled: string;
    updated: string;
    deleted: string;
    postedOk: string;
    needMedia: string;
    needWhen: string;
    onlyImageFile: string;
    onlyVideoFile: string;
    fileTooLarge: (mb: number) => string;
    uploadFailed: string;
    loadFailed: string;
    emptyMonth: string;
    cronNote: string; // 브라우저 꺼도 게시된다는 안내
    // 일괄 업데이트(구글 시트)
    importLabel: string;
    importPlaceholder: string;
    importLoading: string;
    importTitle: string;
    importSummary: (importable: number, invalid: number, total: number) => string;
    importColWhen: string;
    importColCaption: string;
    importColMedia: string;
    importHasVideo: string;
    importExcluded: string;
    importConfirm: (n: number) => string;
    importCommitting: string;
    importNoRows: string;
    importDone: (created: number, updated: number, skippedPosted: number) => string;
    importHint: string;
    importClose: string;
  };
};

export const ADMIN_DICT: Record<AdminLocale, Dict> = {
  ko: {
    appName: '123Band Admin',
    logout: '로그아웃',
    openMenu: '메뉴 열기',
    close: '닫기',
    nav: {
      dashboard: '대시보드',
      desk: '현장 데스크',
      traffic: '방문자수/트래픽수',
      funnel: '퍼널분석',
      weekly: '주간리포트',
      members: '일반회원',
      'member-activity': '회원활동',
      'organizer-contracts': '오거나이저 계약',
      partners: '오거나이저회원',
      products: '상품관리',
      'event-passes': '행사패스관리',
      live: '라이브 방송관리',
      jnj: 'J&J 대회관리',
      'jnj-divisions': '부문관리',
      'jnj-reviews': 'J&J 대회 후기',
      'jnj-judges': '심사위원관리',
      'jnj-winners': '우승자관리',
      'jnj-scores': '점수관리',
      'jnj-participants': '참가자관리',
      categories: '카테고리관리',
      orders: '주문관리',
      shipments: '배송관리',
      boards: '게시판관리',
      'product-reviews': '상품후기',
      'product-qna': '상품문의',
      banners: '배너관리',
      menus: '메뉴관리',
      'main-sections': '메인화면관리',
      coupons: '쿠폰관리',
      points: '포인트관리',
      stamps: '스탬프관리',
      notices: '알림관리',
      achievements: '업적관리',
      social: '소셜관리',
      newsletter: '뉴스레터',
      'mail-templates': '메일링 관리',
      instagram: '인스타그램',
      'code-values': '코드관리',
      settings: '설정',
    },
    common: {
      add: '추가',
      allSuffix: '전체',
      select: '선택',
      copy: '복사',
      delete: '삭제',
      preview: '미리보기',
      previewTitle: '고객 페이지로 미리보기 (승인 전 포함)',
      duplicateAsDraft: '이 행사패스를 초안으로 복제',
      deleteConfirm: "'{name}' 항목을 삭제하시겠어요? 되돌릴 수 없습니다.",
    },
    table: { total: '총 {n}건', loading: '불러오는 중…', empty: '데이터 없음.', selected: '{n}개 선택됨' },
    form: {
      save: '저장',
      saving: '저장 중…',
      cancel: '취소',
      requiredField: '{label}은(는) 필수입니다.',
      jsonInvalid: '잘못된 JSON 형식입니다. 확인 후 다시 시도하세요.',
      jsonInvalidShort: 'JSON 형식이 올바르지 않습니다.',
      inputField: '입력',
      inputLanguage: '입력 언어',
      validationFailed: '검증 실패',
      saveFailed: '저장 실패',
      i18nFallbackHint: 'EN 값이 비어 있으면 폴백이 동작하지 않습니다.',
      i18nMirrorHint: (from: string) => `${from} 입력을 그대로 복사한 값입니다. 직접 고치면 이후 자동 복사되지 않습니다.`,
      i18nFallbackFrom: (from: string) => `비워두면 ${from} 값이 그대로 노출됩니다.`,
    },
    categories: {
      title: '카테고리관리',
      drawerEdit: '카테고리 수정',
      drawerCreate: '카테고리 추가',
      empty: '카테고리 없음.',
      hidden: '숨김',
      topLevel: '— 대분류 —',
      field: { code: '코드', name: '이름', parent: '상위 분류 (없으면 대분류)', sortOrder: '노출순서', visible: '노출' },
    },
    imageField: {
      uploading: '업로드 중…',
      change: '이미지 변경',
      upload: '이미지 업로드',
      remove: '제거',
      hint: 'JPG·PNG·WebP, 5MB 이하. 정사각형 권장.',
      onlyImages: '이미지 파일만 업로드할 수 있습니다.',
      maxSize: '파일 크기는 5MB 이하여야 합니다.',
      uploadFailed: '업로드에 실패했습니다.',
      previewAlt: '썸네일 미리보기',
    },
    linksField: {
      add: '링크 추가',
      remove: '링크 삭제',
      moveUp: '위로',
      moveDown: '아래로',
      placeholder: 'https://youtu.be/… · https://vimeo.com/… · .mp4 주소',
      notPlayable: '재생 불가',
      maxHint: '최대 {n}개까지 넣을 수 있습니다. 유튜브·비메오·mp4 주소를 지원합니다.',
      maxReached: '최대 개수에 도달했습니다',
    },
    aiEditor: {
      title: '상세 페이지 (HTML 에디터)',
      aiDraft: 'AI 초안',
      panelHint: '상품명·키워드·특징을 입력하면 AI가 영어 초안 HTML 을 만들어 에디터에 채웁니다.',
      keywordsPh: '핵심 키워드 (쉼표로 구분)',
      featuresPh: '특징 (한 줄에 하나)',
      imageUrlsPh: '이미지 URL (한 줄에 하나, 선택)',
      generateEn: '영어(EN) 초안 생성',
      enterNameFirst: '먼저 위에서 상품명을 입력하세요.',
      writeEnFirst: '먼저 영어(EN) 상세를 작성하거나 생성하세요.',
      genFailed: '생성 실패',
      transFailed: '번역 실패',
      translateLabel: 'EN→{lang} 번역',
      preview: '미리보기 ({lang})',
      fullPreview: '전체 미리보기',
      previewEmpty: '에디터에 입력하면 여기에 미리보기가 표시됩니다.',
      detailPreview: '상품 상세 미리보기 ({lang})',
      editorPlaceholder: "<h2>제목</h2>\n<p>상품 설명을 HTML 로 직접 작성하거나 위 'AI 초안'으로 생성하세요.</p>\n\n저장하면 고객 상품 상세 페이지에 그대로 표시됩니다.",
      snip: { heading: '제목', paragraph: '단락', list: '목록', image: '이미지' },
    },
    eventEditor: {
      title: '이벤트 페이지 콘텐츠 (티켓)',
      loading: '불러오는 중…',
      onlyTicket: "이벤트 페이지 콘텐츠는 ‘티켓’ 타입 상품에만 적용됩니다. 타입을 ‘티켓’으로 변경하세요.",
      addUrl: '+ URL 추가',
      delete: '삭제',
      mediaTitle: '미디어 (유튜브·인스타·이미지·동영상 URL)',
      mediaHint: 'URL 을 붙여넣으면 종류를 자동 인식해 본문 상단에 순서대로 표시합니다. 여러 개 추가할 수 있습니다. 인스타그램은 공개 게시물만 표시됩니다.',
      mediaUrlPh: 'https://youtu.be/… , https://instagram.com/p/… , https://…/image.jpg',
      sectionsHint: '각 섹션은 HTML 로 입력합니다(이미지·목록·서식 가능). 내용이 있는 섹션만 고객 페이지 메뉴/본문에 노출됩니다.',
      sectionLabel: '섹션 — {name} (HTML)',
      field: {
        banner: '배너 이미지 URL',
        badge: '상단 배지',
        subtitle: '부제',
        location: '장소',
        priceText: '비용 표기 (비우면 상품가/무료 자동)',
        startAt: '일시 시작',
        endAt: '일시 종료',
        applyStart: '신청 시작',
        applyEnd: '신청 종료',
      },
      section: { about: '행사 소개', inclusions: '티켓 포함 사항', venue: '행사 장소', notice: '공지/안내', contact: '문의 하기', channel: '채널 정보', recommend: '추천', refund: '취소/환불' },
    },
    country: { label: '국가', placeholder: '국가 선택', search: '국가 검색…', clear: '— 선택 해제 —', noResults: '검색 결과 없음' },
    seller: { partner: '오거나이저', own: '자사' },
    status: {
      draft: '초안',
      pending: '승인대기',
      active: '판매중',
      soldout: '품절',
      inactive: '비활성',
    },
    transitions: {
      requestApproval: '승인요청',
      approve: '승인',
      reject: '반려',
      soldout: '품절',
      inactive: '비활성',
      resume: '재개',
    },
    actions: {
      approve: '승인 — 입점 활성화',
      reject: '반려 — 신청 거절',
      suspend: '판매 정지',
      restore: '판매 재개',
      ban: '로그인 차단',
      unban: '차단 해제',
      delete: '삭제 (되돌릴 수 없음)',
      confirmBan: '이 계정의 로그인을 차단할까요? (나중에 해제할 수 있습니다)',
      confirmDelete: "'{name}' 오거나이저를 삭제하시겠어요? 되돌릴 수 없습니다.",
      banned: '차단됨',
      unbanned: '해제됨',
      failed: '실패',
      orderPaid: '결제 확인',
      orderCancel: '주문 취소',
      orderShip: '발송 처리',
      orderRefund: '환불 처리',
      orderDone: '완료 처리',
      fallbackProduct: '상품',
      confirmDeleteProduct: "'{name}' 상품을 삭제하시겠어요? 되돌릴 수 없습니다.",
    },
    eventPasses: {
      title: '행사패스관리',
      drawerEdit: '행사패스 수정',
      drawerCreate: '행사패스 등록',
      searchPlaceholder: '코드·아이디·판매자 검색',
      fallbackName: '행사패스',
      deleteConfirm: "'{name}' 행사패스를 삭제하시겠어요? 되돌릴 수 없습니다.",
      duplicateTitle: '이 행사패스를 초안으로 복제',
      col: {
        name: '행사패스명',
        sellerAccount: '판매자 계정',
        seller: '판매자',
        price: '가격(USD)',
        status: '상태',
        actions: '승인/상태',
      },
      field: {
        name_i18n: '행사패스명',
        image_url: '대표 이미지(썸네일)',
        category_id: '카테고리',
        prices: '가격',
        attributes: '속성(JSON)',
        detail_html_i18n: '상세 HTML (AI 생성)',
        event_content: '이벤트 콘텐츠 (일정/장소)',
        status: '상태',
      },
    },
    settings: {
      title: '설정',
      intro: '외부 연동·운영에 필요한 설정을 이곳에서 관리합니다.',
      snsTitle: 'SNS',
      instagram: 'Instagram',
      instagramDesc: '즉시/예약 게시에 사용할 인스타그램 비즈니스 계정과 액세스 토큰입니다. 안전하게 서버에 저장됩니다.',
      igHandle: '인스타그램 계정(핸들)',
      igHandlePh: '예: latindada',
      igToken: '액세스 토큰',
      igTokenPh: 'Instagram Graph API 액세스 토큰',
      showToken: '토큰 보기',
      hideToken: '토큰 숨기기',
      tokenSaved: '저장된 토큰이 있습니다. 비워 두면 기존 토큰이 유지되고, 새로 입력하면 교체됩니다.',
      connected: '연결됨',
      tokenValidUntil: (date, days) => `유효기간 ${date}까지 (${days}일 남음)`,
      tokenAutoRenew: '만료 전 자동으로 갱신되므로 토큰을 다시 발급할 필요가 없습니다.',
      tokenExpiringSoon: '만료가 임박했습니다. 자동 갱신에 실패한 상태일 수 있으니 새 토큰을 입력해 주세요.',
      tokenExpired: '토큰이 만료되었습니다. 새 토큰을 발급해 입력해 주세요.',
      tokenNoExpiry: '장기 토큰으로 교환되지 않아 만료일을 알 수 없습니다. 자동 갱신이 동작하지 않습니다.',
      paymentsTitle: '결제',
      wise: 'Wise 송금 링크',
      wiseDesc: '체크아웃에서 카드결제 대안으로 노출되는 Wise 결제 페이지 링크입니다. 고객은 QR 또는 버튼으로 이 링크에 접속해 송금합니다.',
      wiseUrl: '결제 링크 (URL)',
      wiseUrlPh: '예: https://wise.com/pay/me/xxxxxxx',
      wiseEnabled: '체크아웃에 노출',
      wiseEnabledHint: '끄면 결제 페이지에서 Wise 송금 옵션이 숨겨집니다.',
      notifyTitle: '알림',
      notifyEmails: '운영자 메일 수신자',
      notifyEmailsDesc: '오거나이저 신청·주문·문의 같은 운영자 알림 메일을 받을 주소입니다. 최대 5개까지 넣을 수 있고, 넣은 주소 모두에게 같은 메일이 갑니다.',
      notifyEmailPh: (n) => `수신자 ${n}`,
      notifyEmailsEmpty: '한 개도 넣지 않으면 서버에 설정된 기본 주소로 갑니다.',
      save: '저장',
      saving: '저장 중…',
      saved: '저장되었습니다.',
      saveFailed: '저장에 실패했습니다.',
      loading: '불러오는 중…',
    },
    instagram: {
      title: '인스타그램',
      intro: '날짜를 눌러 게시물을 만들고 예약하세요. 예약한 시각이 되면 자동으로 게시됩니다.',
      notConnected: '인스타그램 계정이 연결되어 있지 않습니다. 설정에서 먼저 연결하세요.',
      goToSettings: '설정으로 이동',
      connectedAs: (handle) => `@${handle} 계정으로 게시됩니다`,
      today: '오늘',
      prevMonth: '이전 달',
      nextMonth: '다음 달',
      weekdays: ['일', '월', '화', '수', '목', '금', '토'],
      addOnDay: '이 날짜에 게시물 추가',
      morePosts: (n) => `+${n}건 더`,
      statusScheduled: '예약됨',
      statusPublishing: '게시 중',
      statusPosted: '게시 완료',
      statusFailed: '실패',
      statusCanceled: '취소됨',
      newPost: '새 게시물',
      editPost: '게시물 수정',
      when: '게시 일시',
      mediaKind: '미디어 종류',
      kindImage: '이미지',
      kindVideo: '동영상',
      videoHint: '동영상은 릴스(Reels)로 게시됩니다. MP4 권장.',
      source: '가져올 방법',
      sourceUpload: '파일 업로드',
      sourceUrl: 'URL 입력',
      upload: '파일 선택',
      uploading: '업로드 중…',
      mediaUrlPh: 'https://… (공개 접근 가능한 주소)',
      coverUrl: '커버 이미지 URL (선택)',
      coverUrlPh: '릴스 표지로 쓸 이미지 주소',
      caption: '캡션',
      captionPh: '게시물에 들어갈 문구와 해시태그를 입력하세요.',
      captionCount: (n, max) => `${n} / ${max}자`,
      previewTitle: '미리보기',
      previewEmpty: '이미지나 동영상을 넣으면 여기에 미리보기가 표시됩니다.',
      schedule: '예약하기',
      scheduleSaving: '저장 중…',
      postNow: '지금 게시',
      posting: '게시 중…',
      deletePost: '삭제',
      deleteConfirm: '이 게시물을 삭제할까요? 예약이 취소됩니다.',
      openPost: '인스타그램에서 보기',
      cancel: '닫기',
      scheduled: '예약되었습니다.',
      updated: '수정되었습니다.',
      deleted: '삭제되었습니다.',
      postedOk: '게시되었습니다.',
      needMedia: '이미지 또는 동영상을 넣어 주세요.',
      needWhen: '게시 일시를 선택해 주세요.',
      onlyImageFile: '이미지 파일만 올릴 수 있습니다.',
      onlyVideoFile: '동영상 파일만 올릴 수 있습니다.',
      fileTooLarge: (mb) => `파일이 너무 큽니다. ${mb}MB 이하로 올려 주세요.`,
      uploadFailed: '업로드에 실패했습니다.',
      loadFailed: '목록을 불러오지 못했습니다.',
      emptyMonth: '이 달에는 예약된 게시물이 없습니다.',
      cronNote: '예약은 서버에 저장되므로 브라우저를 닫아도 정시에 게시됩니다.',
      importLabel: '일괄 업데이트',
      importPlaceholder: '구글 시트 링크 붙여넣기',
      importLoading: '불러오는 중…',
      importTitle: '시트에서 일괄 등록',
      importSummary: (imp, inv, total) => `IG 대상 ${imp}건 · 제외 ${inv}건 · 시트 총 ${total}행`,
      importColWhen: '게시 일시',
      importColCaption: '캡션',
      importColMedia: '동영상',
      importHasVideo: '링크 있음',
      importExcluded: '제외',
      importConfirm: (n) => `${n}건 등록`,
      importCommitting: '등록 중…',
      importNoRows: '등록할 IG 게시물이 없습니다. 시트 Platforms 열에 IG 가 포함됐는지 확인하세요.',
      importDone: (c, u, sp) =>
        `등록 완료 — 새로 ${c}건, 갱신 ${u}건` + (sp ? `, 게시완료 제외 ${sp}건` : ''),
      importHint: '동영상은 릴스로, Date·Time(한국시간) 기준으로 예약됩니다. 이미 게시된 항목은 건너뜁니다.',
      importClose: '닫기',
    },
  },
  en: {
    appName: '123Band Admin',
    logout: 'Log out',
    openMenu: 'Open menu',
    close: 'Close',
    nav: {
      dashboard: 'Dashboard',
      desk: 'On-site desk',
      traffic: 'Traffic',
      funnel: 'Funnel',
      weekly: 'Weekly report',
      members: 'Members',
      'member-activity': 'Member Activity',
      'organizer-contracts': 'Organizer contracts',
      partners: 'Organizers',
      products: 'Products',
      'event-passes': 'Event Passes',
      live: 'Live Broadcasts',
      jnj: 'J&J Competitions',
      'jnj-divisions': 'Divisions',
      'jnj-reviews': 'J&J Reviews',
      'jnj-judges': 'Judges',
      'jnj-winners': 'Winners',
      'jnj-scores': 'Scores',
      'jnj-participants': 'Participants',
      categories: 'Categories',
      orders: 'Orders',
      shipments: 'Shipments',
      boards: 'Boards',
      'product-reviews': 'Product Reviews',
      'product-qna': 'Product Q&A',
      banners: 'Banners',
      menus: 'Menus',
      'main-sections': 'Main Sections',
      coupons: 'Coupons',
      points: 'Points',
      stamps: 'Stamps',
      notices: 'Notifications',
      achievements: 'Achievements',
      social: 'Social',
      newsletter: 'Newsletter',
      'mail-templates': 'Mail templates',
      instagram: 'Instagram',
      'code-values': 'Code values',
      settings: 'Settings',
    },
    common: {
      add: 'Add',
      allSuffix: 'All',
      select: 'Select',
      copy: 'Copy',
      delete: 'Delete',
      preview: 'Preview',
      previewTitle: 'Preview on customer page (incl. before approval)',
      duplicateAsDraft: 'Duplicate this pass as a draft',
      deleteConfirm: "Delete '{name}'? This cannot be undone.",
    },
    table: { total: '{n} total', loading: 'Loading…', empty: 'No data.', selected: '{n} selected' },
    form: {
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      requiredField: '{label} is required.',
      jsonInvalid: 'Invalid JSON. Please check and try again.',
      jsonInvalidShort: 'Invalid JSON format.',
      inputField: 'input',
      inputLanguage: 'Input language',
      validationFailed: 'Validation failed',
      saveFailed: 'Save failed',
      i18nFallbackHint: 'If EN is empty, fallback will not work.',
      i18nMirrorHint: (from: string) => `Copied as-is from ${from}. Edit it here and it will no longer be auto-copied.`,
      i18nFallbackFrom: (from: string) => `Leave empty and the ${from} value is shown instead.`,
    },
    categories: {
      title: 'Categories',
      drawerEdit: 'Edit Category',
      drawerCreate: 'New Category',
      empty: 'No categories.',
      hidden: 'Hidden',
      topLevel: '— Top level —',
      field: { code: 'Code', name: 'Name', parent: 'Parent (none = top level)', sortOrder: 'Sort order', visible: 'Visible' },
    },
    imageField: {
      uploading: 'Uploading…',
      change: 'Change image',
      upload: 'Upload image',
      remove: 'Remove',
      hint: 'JPG·PNG·WebP, up to 5MB. Square recommended.',
      onlyImages: 'Only image files can be uploaded.',
      maxSize: 'File size must be 5MB or less.',
      uploadFailed: 'Upload failed.',
      previewAlt: 'Thumbnail preview',
    },
    linksField: {
      add: 'Add link',
      remove: 'Remove link',
      moveUp: 'Move up',
      moveDown: 'Move down',
      placeholder: 'https://youtu.be/… · https://vimeo.com/… · .mp4 URL',
      notPlayable: 'Not playable',
      maxHint: 'Up to {n} links. YouTube, Vimeo and .mp4 URLs are supported.',
      maxReached: 'Maximum reached',
    },
    aiEditor: {
      title: 'Detail page (HTML editor)',
      aiDraft: 'AI draft',
      panelHint: 'Enter product name, keywords and features — AI will generate an English HTML draft into the editor.',
      keywordsPh: 'Key keywords (comma-separated)',
      featuresPh: 'Features (one per line)',
      imageUrlsPh: 'Image URLs (one per line, optional)',
      generateEn: 'Generate English (EN) draft',
      enterNameFirst: 'Enter the product name above first.',
      writeEnFirst: 'Write or generate the English (EN) detail first.',
      genFailed: 'Generation failed',
      transFailed: 'Translation failed',
      translateLabel: 'Translate EN→{lang}',
      preview: 'Preview ({lang})',
      fullPreview: 'Full preview',
      previewEmpty: 'Type in the editor to see a preview here.',
      detailPreview: 'Product detail preview ({lang})',
      editorPlaceholder: "<h2>Title</h2>\n<p>Write the product description in HTML, or generate it with 'AI draft' above.</p>\n\nWhen saved, it appears as-is on the customer product detail page.",
      snip: { heading: 'Heading', paragraph: 'Paragraph', list: 'List', image: 'Image' },
    },
    eventEditor: {
      title: 'Event page content (ticket)',
      loading: 'Loading…',
      onlyTicket: "Event page content applies only to 'ticket' type products. Change the type to 'ticket'.",
      addUrl: '+ Add URL',
      delete: 'Delete',
      mediaTitle: 'Media (YouTube · Instagram · image · video URL)',
      mediaHint: 'Paste a URL — the type is auto-detected and shown at the top of the body in order. You can add multiple. Only public Instagram posts are shown.',
      mediaUrlPh: 'https://youtu.be/… , https://instagram.com/p/… , https://…/image.jpg',
      sectionsHint: 'Each section is entered as HTML (images, lists, formatting allowed). Only sections with content appear in the customer page menu/body.',
      sectionLabel: 'Section — {name} (HTML)',
      field: {
        banner: 'Banner image URL',
        badge: 'Top badge',
        subtitle: 'Subtitle',
        location: 'Location',
        priceText: 'Price text (leave empty for auto product price/free)',
        startAt: 'Start date/time',
        endAt: 'End date/time',
        applyStart: 'Registration start',
        applyEnd: 'Registration end',
      },
      section: { about: 'About', inclusions: 'Ticket Inclusions', venue: 'Venue', notice: 'Notice', contact: 'Contact', channel: 'Channel', recommend: 'Recommended', refund: 'Cancellation / Refund' },
    },
    country: { label: 'Country', placeholder: 'Select country', search: 'Search country…', clear: '— Clear —', noResults: 'No results' },
    seller: { partner: 'Organizer', own: 'In-house' },
    status: {
      draft: 'Draft',
      pending: 'Pending',
      active: 'On sale',
      soldout: 'Sold out',
      inactive: 'Inactive',
    },
    transitions: {
      requestApproval: 'Request approval',
      approve: 'Approve',
      reject: 'Reject',
      soldout: 'Sold out',
      inactive: 'Deactivate',
      resume: 'Resume',
    },
    actions: {
      approve: 'Approve — activate organizer',
      reject: 'Reject application',
      suspend: 'Suspend selling',
      restore: 'Resume selling',
      ban: 'Block login',
      unban: 'Unblock login',
      delete: 'Delete (irreversible)',
      confirmBan: 'Block this account from signing in? (You can unblock later.)',
      confirmDelete: "Delete organizer '{name}'? This cannot be undone.",
      banned: 'Blocked',
      unbanned: 'Unblocked',
      failed: 'Failed',
      orderPaid: 'Confirm payment',
      orderCancel: 'Cancel order',
      orderShip: 'Mark shipped',
      orderRefund: 'Refund',
      orderDone: 'Mark complete',
      fallbackProduct: 'product',
      confirmDeleteProduct: "Delete product '{name}'? This cannot be undone.",
    },
    eventPasses: {
      title: 'Event Passes',
      drawerEdit: 'Edit Event Pass',
      drawerCreate: 'New Event Pass',
      searchPlaceholder: 'Search code · ID · seller',
      fallbackName: 'event pass',
      deleteConfirm: "Delete event pass '{name}'? This cannot be undone.",
      duplicateTitle: 'Duplicate this pass as a draft',
      col: {
        name: 'Pass name',
        sellerAccount: 'Seller account',
        seller: 'Seller',
        price: 'Price (USD)',
        status: 'Status',
        actions: 'Approval / Status',
      },
      field: {
        name_i18n: 'Pass name',
        image_url: 'Thumbnail image',
        category_id: 'Category',
        prices: 'Price',
        attributes: 'Attributes (JSON)',
        detail_html_i18n: 'Detail HTML (AI)',
        event_content: 'Event content (schedule/venue)',
        status: 'Status',
      },
    },
    settings: {
      title: 'Settings',
      intro: 'Manage settings for integrations and operations here.',
      snsTitle: 'SNS',
      instagram: 'Instagram',
      instagramDesc: 'Instagram business account and access token used for immediate/scheduled posting. Stored securely on the server.',
      igHandle: 'Instagram handle',
      igHandlePh: 'e.g. latindada',
      igToken: 'Access token',
      igTokenPh: 'Instagram Graph API access token',
      showToken: 'Show token',
      hideToken: 'Hide token',
      tokenSaved: 'A token is saved. Leave blank to keep it, or enter a new one to replace it.',
      connected: 'Connected',
      tokenValidUntil: (date, days) => `Valid until ${date} (${days} days left)`,
      tokenAutoRenew: 'Renewed automatically before it expires — you do not need to reissue it.',
      tokenExpiringSoon: 'Expiring soon. Automatic renewal may have failed; please enter a new token.',
      tokenExpired: 'The token has expired. Please issue a new one and enter it here.',
      tokenNoExpiry: 'Not exchanged for a long-lived token, so the expiry is unknown. Automatic renewal is inactive.',
      paymentsTitle: 'Payments',
      wise: 'Wise transfer link',
      wiseDesc: 'The Wise payment page link shown at checkout as an alternative to card payment. Customers open it via the QR code or button to send money.',
      wiseUrl: 'Payment link (URL)',
      wiseUrlPh: 'e.g. https://wise.com/pay/me/xxxxxxx',
      wiseEnabled: 'Show at checkout',
      wiseEnabledHint: 'When off, the Wise transfer option is hidden on the checkout page.',
      notifyTitle: 'Notifications',
      notifyEmails: 'Admin email recipients',
      notifyEmailsDesc: 'Addresses that receive admin notification mail — organizer applications, orders, enquiries. Up to five; every address listed gets the same mail.',
      notifyEmailPh: (n) => `Recipient ${n}`,
      notifyEmailsEmpty: 'If you leave all of them empty, mail goes to the default address configured on the server.',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved.',
      saveFailed: 'Save failed.',
      loading: 'Loading…',
    },
    instagram: {
      title: 'Instagram',
      intro: 'Click a date to compose and schedule a post. It publishes automatically at the scheduled time.',
      notConnected: 'No Instagram account is connected. Connect one in Settings first.',
      goToSettings: 'Go to Settings',
      connectedAs: (handle) => `Posting as @${handle}`,
      today: 'Today',
      prevMonth: 'Previous month',
      nextMonth: 'Next month',
      weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      addOnDay: 'Add a post on this date',
      morePosts: (n) => `+${n} more`,
      statusScheduled: 'Scheduled',
      statusPublishing: 'Publishing',
      statusPosted: 'Posted',
      statusFailed: 'Failed',
      statusCanceled: 'Canceled',
      newPost: 'New post',
      editPost: 'Edit post',
      when: 'Post date & time',
      mediaKind: 'Media type',
      kindImage: 'Image',
      kindVideo: 'Video',
      videoHint: 'Videos are published as Reels. MP4 recommended.',
      source: 'Source',
      sourceUpload: 'Upload file',
      sourceUrl: 'Enter URL',
      upload: 'Choose file',
      uploading: 'Uploading…',
      mediaUrlPh: 'https://… (must be publicly reachable)',
      coverUrl: 'Cover image URL (optional)',
      coverUrlPh: 'Image used as the Reels cover',
      caption: 'Caption',
      captionPh: 'Write the caption and hashtags for this post.',
      captionCount: (n, max) => `${n} / ${max}`,
      previewTitle: 'Preview',
      previewEmpty: 'Add an image or video to see a preview here.',
      schedule: 'Schedule',
      scheduleSaving: 'Saving…',
      postNow: 'Post now',
      posting: 'Posting…',
      deletePost: 'Delete',
      deleteConfirm: 'Delete this post? The schedule will be canceled.',
      openPost: 'View on Instagram',
      cancel: 'Close',
      scheduled: 'Scheduled.',
      updated: 'Updated.',
      deleted: 'Deleted.',
      postedOk: 'Posted.',
      needMedia: 'Please add an image or video.',
      needWhen: 'Please pick a date and time.',
      onlyImageFile: 'Only image files can be uploaded.',
      onlyVideoFile: 'Only video files can be uploaded.',
      fileTooLarge: (mb) => `File is too large. Please keep it under ${mb}MB.`,
      uploadFailed: 'Upload failed.',
      loadFailed: 'Could not load the list.',
      emptyMonth: 'No posts scheduled this month.',
      cronNote: 'Schedules live on the server, so posts go out on time even if you close the browser.',
      importLabel: 'Bulk import',
      importPlaceholder: 'Paste Google Sheet link',
      importLoading: 'Loading…',
      importTitle: 'Bulk import from sheet',
      importSummary: (imp, inv, total) => `${imp} for IG · ${inv} excluded · ${total} rows total`,
      importColWhen: 'When',
      importColCaption: 'Caption',
      importColMedia: 'Video',
      importHasVideo: 'Link OK',
      importExcluded: 'Excluded',
      importConfirm: (n) => `Import ${n}`,
      importCommitting: 'Importing…',
      importNoRows: 'No IG posts to import. Make sure the Platforms column contains IG.',
      importDone: (c, u, sp) =>
        `Done — ${c} created, ${u} updated` + (sp ? `, ${sp} already posted (skipped)` : ''),
      importHint: 'Videos post as Reels, scheduled by Date·Time (KST). Already-posted items are skipped.',
      importClose: 'Close',
    },
  },
};

export type AdminDict = Dict;
