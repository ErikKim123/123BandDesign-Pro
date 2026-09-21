import React from "react";

const VARIANTS = {
  base: {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline-soft)",
    padding: "var(--space-xl)",
    boxShadow: "none",
  },
  feature: {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline-soft)",
    padding: "var(--space-xxl)",
    boxShadow: "none",
  },
  cream: {
    background: "var(--color-cream)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-beige-deep)",
    padding: "var(--space-xxl)",
    boxShadow: "none",
  },
  "cream-soft": {
    background: "var(--color-surface-cream-soft)",
    color: "var(--color-ink)",
    border: "1px solid transparent",
    padding: "var(--space-xxl)",
    boxShadow: "none",
  },
  product: {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline-soft)",
    padding: "var(--space-xxl)",
    boxShadow: "var(--shadow-2)",
  },
  photographic: {
    background: "var(--color-surface-code)",
    color: "var(--color-on-dark)",
    border: "1px solid transparent",
    padding: "0",
    boxShadow: "var(--shadow-3)",
    overflow: "hidden",
  },
};

/**
 * Flat content card. 12px radius (the dominant Wolf card radius). Default leans
 * on a hairline border, not shadow — reserve elevation for `product`/`photographic`.
 */
export function Card({ variant = "base", children, style, ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.base;
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        ...v,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
