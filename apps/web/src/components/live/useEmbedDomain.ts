'use client';
import { useEffect, useState } from 'react';

/**
 * 유튜브 채팅 임베드는 부모 도메인을 정확히 알아야 렌더된다 — 값이 비거나 어긋나면 채팅이 통째로 안 뜬다.
 * 그래서 설정에 기대지 않고 지금 보고 있는 주소(window.location.hostname)를 쓴다.
 * NEXT_PUBLIC_EMBED_DOMAIN 은 프록시 등 예외 상황에서만 덮어쓰는 선택 값이다.
 *
 * 라이브 섹션(JnjLiveEmbed)이 쓴다.
 */
export function useEmbedDomain(): string | null {
  const [domain, setDomain] = useState<string | null>(null);
  useEffect(() => {
    // 마운트 후에 정한다 — 서버 렌더와 값이 달라 하이드레이션이 깨지는 것을 피한다.
    setDomain(process.env.NEXT_PUBLIC_EMBED_DOMAIN || window.location.hostname);
  }, []);
  return domain;
}
