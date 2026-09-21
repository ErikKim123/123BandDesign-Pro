// 아이콘 액션 버튼/링크 — 호버 시 title 툴팁(설명) 노출. 목록 액션(승인/정지/차단/삭제/미리보기 등)에 사용.
'use client';
import type { LucideIcon } from 'lucide-react';

export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  href,
  target,
  rel,
}: {
  icon: LucideIcon;
  label: string; // 툴팁 + 접근성 라벨
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  href?: string; // 지정 시 <a> 로 렌더(예: 미리보기 새 탭)
  target?: string;
  rel?: string;
}) {
  const cls = `inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${
    danger
      ? 'border-grey-200 text-danger hover:border-danger/50 hover:bg-danger/5'
      : 'border-grey-200 text-grey-600 hover:bg-grey-50 hover:text-black'
  }`;

  if (href) {
    return (
      <a href={href} target={target} rel={rel} title={label} aria-label={label} className={cls}>
        <Icon size={15} />
      </a>
    );
  }
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cls}
    >
      <Icon size={15} />
    </button>
  );
}
