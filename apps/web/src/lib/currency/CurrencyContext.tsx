// 표시 통화(서브통화 토글) 전역 상태 — 상세페이지에서 고른 통화가 장바구니·결제까지 이어지도록 공유한다.
// ⚠️ 표시 전용: 실제 결제는 항상 결제 통화(payCurrency=USD/KRW). 서브통화(THB/VND/CNY/JPY)는 화면 표기만.
'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { DISPLAY_CURRENCIES, type Currency, type Locale } from '@123band/shared';
import { currencyForLocale } from '@/lib/locale';

// 선택한 표시 통화 저장 키 — 새로고침·재방문에도 선택이 유지된다(로케일/사용자 무관 UI 선호값).
const STORAGE_KEY = 'band-display-currency';

interface DisplayCurrencyState {
  /**
   * 사용자가 토글로 '직접 고른' 표기 통화. 아직 고른 적 없으면 null.
   * null 이면 각 화면이 그 화면의 기준 통화(baseCurrency)를 쓴다 — 값도 없는 USD 로 환산해 보여주지 않기 위함.
   */
  chosenCurrency: Currency | null;
  /** 실제 결제 통화(로케일 기준, USD/KRW). 표기와 무관하게 결제는 이 통화로 진행. */
  payCurrency: Currency;
  setDisplayCurrency: (c: Currency) => void;
}

const Ctx = createContext<DisplayCurrencyState | null>(null);

export function DisplayCurrencyProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const payCurrency = currencyForLocale(locale);
  // 초기값은 '미선택' — 서버/클라 동일(하이드레이션 안전). 저장된 선택은 마운트 후 effect 로 반영.
  const [chosenCurrency, setState] = useState<Currency | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && (DISPLAY_CURRENCIES as readonly string[]).includes(raw)) {
        setState(raw as Currency);
      }
    } catch {
      /* 저장소 접근 불가 무시 */
    }
  }, []);

  const setDisplayCurrency = (c: Currency) => {
    setState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* 무시 */
    }
  };

  return (
    <Ctx.Provider value={{ chosenCurrency, payCurrency, setDisplayCurrency }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDisplayCurrency(): DisplayCurrencyState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDisplayCurrency 는 DisplayCurrencyProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
