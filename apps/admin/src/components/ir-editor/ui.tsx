'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toHex } from './render';

export function IconButton({
  title,
  onClick,
  active,
  disabled,
  children,
  className = '',
}: {
  title: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`ire-btn ${active ? 'is-active' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Popover({
  button,
  title,
  children,
  align = 'left',
  disabled,
}: {
  button: ReactNode;
  title: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div className="ire-popover-wrap" ref={ref}>
      <IconButton title={title} active={open} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        {button}
      </IconButton>
      {open && (
        <div className={`ire-popover ${align === 'right' ? 'is-right' : ''}`}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export function ColorSwatch({ value, onChange, title }: { value: string; onChange: (v: string) => void; title: string }) {
  return (
    <label className="ire-swatch" title={title}>
      <span style={{ background: value }} />
      <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="ire-slider">
      <div className="ire-slider-head">
        <span>{label}</span>
        <span>
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

export const PRESET_COLORS = [
  '#ffffff', '#f5f5f5', '#d9d9d9', '#9b9b9b', '#4a4a4a', '#000000',
  '#ffe8e8', '#ff6b6b', '#e03131', '#fff3bf', '#fcc419', '#f08c00',
  '#e6fcf5', '#38d9a9', '#0ca678', '#e7f5ff', '#4dabf7', '#1c7ed6',
  '#f3f0ff', '#9775fa', '#6741d9', '#0b1f3a', '#12355b', '#264653',
];
