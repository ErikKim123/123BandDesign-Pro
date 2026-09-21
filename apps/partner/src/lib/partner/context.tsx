// 로그인한 오거나이저의 식별자/입점정보를 클라이언트 트리에 공급.
// (dashboard)/layout 서버 컴포넌트가 세션·partners 행을 조회해 PartnerShell 로 주입한다.
'use client';
import { createContext, useContext, type ReactNode } from 'react';

export interface PartnerInfo {
  id: string;
  company_name: string | null;
  commission_rate: number;
  status: string; // 'pending' | 'active' | 'suspended'
}

export interface PartnerSession {
  userId: string;
  email: string;
  /** partners 행이 아직 없으면 null (입점정보 미작성) */
  partner: PartnerInfo | null;
}

const Ctx = createContext<PartnerSession | null>(null);

export function PartnerProvider({
  value,
  children,
}: {
  value: PartnerSession;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 대시보드 하위 클라이언트 컴포넌트에서 현재 오거나이저 세션을 읽는다. */
export function usePartner(): PartnerSession {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePartner 는 PartnerProvider 안에서만 사용할 수 있습니다.');
  return v;
}
