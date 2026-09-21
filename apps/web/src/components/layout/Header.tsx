// Design Ref: Wolf Design System / components/navigation — 고객몰 헤더 (로고 + 네비 + 언어전환), 반응형
import Link from 'next/link';
import Image from 'next/image';
import { User, Search } from 'lucide-react';
import type { Locale } from '@123band/shared';
import { LocaleSwitcher } from './LocaleSwitcher';
import { MobileNav } from './MobileNav';
import { CartLink } from '@/components/cart/CartLink';
import { NoticeCenter } from '@/components/notices/NoticeCenter';
import { AddToHomeScreen, type A2hsLabels } from '@/components/pwa/AddToHomeScreen';
import type { Dictionary } from '@/i18n/dictionaries';

export interface NavItem {
  href: string;
  label: string;
}

export function Header({
  locale,
  dict,
  isAuthed,
  menu,
}: {
  locale: Locale;
  dict: Dictionary;
  isAuthed: boolean;
  /** 메뉴관리(DB)에서 온 상단 메뉴. 없으면 코드 기본값으로 폴백. */
  menu?: NavItem[];
}) {
  // DB(메뉴관리) 조회가 실패했을 때의 폴백.
  // 실제 운영 메뉴와 어긋나 있으면 장애 때 특정 메뉴가 통째로 사라진 것처럼 보인다 —
  // J&J 가 빠져 있어서 실제로 그런 일이 있었다. DB 기본 구성과 같게 유지할 것.
  const fallbackNav: NavItem[] = [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/events`, label: dict.nav.calendar },
    { href: `/${locale}/shop?type=ticket`, label: dict.nav.tickets },
    { href: `/${locale}/jnj`, label: dict.nav.jnj },
    { href: `/${locale}/boards`, label: dict.nav.boards },
  ];
  const nav = menu && menu.length > 0 ? menu : fallbackNav;

  // 버튼 라벨 — 헤더(PC=북마크 Ctrl+D 안내)와 모바일 드로어(=홈 화면 추가)에서 공용
  const a2hsLabels: A2hsLabels =
    locale === 'ko'
      ? {
          button: '홈 화면에 추가',
          bookmarkButton: '북마크에 추가',
          bookmarkTitle: '북마크에 추가',
          bookmarkHint: '아래 단축키를 누르면 브라우저 북마크 창이 열립니다.',
          bookmarkDo: '북마크 하기',
          bookmarkBlocked: '브라우저 보안상 버튼으로는 자동 추가가 안 돼요. 위 단축키를 눌러 추가해 주세요.',
          bookmarkDone: '북마크에 추가했어요!',
          added: '바탕화면에 바로가기 아이콘이 추가됩니다',
          manual: '브라우저 메뉴에서 설치할 수 있어요',
          iosTitle: '홈 화면에 추가',
          iosStep1: '하단의 공유 버튼을 누르세요',
          iosStep2: "'홈 화면에 추가'를 선택하세요",
          iosBmTitle: '북마크에 추가',
          iosBmStep1: '우측 아래 ⋯ 메뉴를 누르세요',
          iosBmStep2: '별표(☆)를 눌러 북마크에 추가하세요',
          iosBmDone: '북마크 목록에 저장됩니다',
          close: '닫기',
        }
      : {
          button: 'Add to Home Screen',
          bookmarkButton: 'Bookmark this page',
          bookmarkTitle: 'Add to bookmarks',
          bookmarkHint: 'Press the shortcut below to open your browser’s bookmark dialog.',
          bookmarkDo: 'Bookmark',
          bookmarkBlocked: 'Your browser blocks auto-bookmarking. Please press the shortcut above.',
          bookmarkDone: 'Bookmarked!',
          added: 'A shortcut icon will be added to your home screen',
          manual: 'You can install this from your browser menu',
          iosTitle: 'Add to Home Screen',
          iosStep1: 'Tap the Share button below',
          iosStep2: "Choose 'Add to Home Screen'",
          iosBmTitle: 'Add a bookmark',
          iosBmStep1: 'Tap the ⋯ menu',
          iosBmStep2: 'Tap the star (☆) to bookmark',
          iosBmDone: 'Saved to your bookmarks',
          close: 'Close',
        };

  return (
    <header className="sticky top-0 z-40 border-b border-grey-200 bg-white/90 backdrop-blur">
      {/* 모바일에서 간격을 좁힌다 — 360~430px 에서 로고+아이콘 묶음이 폭을 넘겨
          언어 전환(KO)이 화면 밖으로 잘려 나갔다. md 이상은 종전 간격 그대로. */}
      <div className="container-band flex h-16 items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2">
          {/* 모바일 햄버거 + 좌측 드로어 (md 이상에선 숨김) */}
          <MobileNav
            nav={nav}
            label={locale === 'ko' ? '메뉴' : 'Menu'}
            closeLabel={locale === 'ko' ? '닫기' : 'Close'}
            a2hsLabels={a2hsLabels}
          />
          <Link href={`/${locale}`} className="flex items-center gap-2">
            {/* 브랜드 마크 — 레드 서클 댄서 엠블럼 */}
            <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5">
              <Image src="/wolf-mark.png" alt="123Band" fill sizes="36px" className="object-cover" priority />
            </span>
            <span className="font-display text-2xl font-extrabold uppercase leading-none tracking-tight text-ink">
              123Band
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm font-medium text-grey-600 transition-colors hover:text-primary"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link href={`/${locale}/search`} className="p-1" aria-label={dict.search.title}>
            <Search size={20} />
          </Link>
          <Link
            href={isAuthed ? `/${locale}/account` : `/${locale}/login`}
            className={`relative p-1 transition-colors ${isAuthed ? 'text-primary' : 'text-grey-700 hover:text-primary'}`}
            aria-label={isAuthed ? dict.auth.account : dict.auth.login}
            title={isAuthed ? dict.auth.account : dict.auth.login}
          >
            {/* 로그인 상태면 아이콘을 채워(브랜드색) 시각적으로 구분 + 진입 시 팝/링 리플로 로그인을 알린다 */}
            {isAuthed && (
              <span
                aria-hidden
                className="signin-ring pointer-events-none absolute inset-0 rounded-full border-2 border-primary"
              />
            )}
            <User
              size={20}
              fill={isAuthed ? 'currentColor' : 'none'}
              className={isAuthed ? 'signin-pop' : undefined}
            />
          </Link>
          {/* 운영자 알림 — 로그인한 회원에게만. 종 배지 + 메시지 카드(소리)를 이 컴포넌트가 맡는다. */}
          <NoticeCenter locale={locale} isAuthed={isAuthed} t={dict.notices} />
          <CartLink locale={locale} />
          {/* PC: 북마크 버튼. 모바일은 드로어(메뉴) 안쪽으로 옮겼으므로 md 이상에서만 노출 */}
          <span className="hidden md:inline-flex">
            <AddToHomeScreen labels={a2hsLabels} />
          </span>
          <LocaleSwitcher current={locale} />
        </div>
      </div>
    </header>
  );
}
