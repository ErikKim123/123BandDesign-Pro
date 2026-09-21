import React from "react";

const VARIANTS = {
  orange: {
    background: "var(--color-primary)",
    color: "var(--color-on-primary)",
    border: "1px solid transparent",
  },
  cream: {
    background: "var(--color-cream-deeper)",
    color: "var(--color-ink)",
    border: "1px solid transparent",
  },
  dark: {
    background: "var(--color-ink)",
    color: "var(--color-on-dark)",
    border: "1px solid transparent",
  },
  outline: {
    background: "transparent",
    color: "var(--color-steel)",
    border: "1px solid var(--color-hairline-strong)",
  },
};

/**
 * Small pill status / category badge. Pills (--radius-full) are reserved
 * for badges in Wolf — buttons never use them.
 */
export function Badge({ variant = "orange", children, style, ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.orange;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontFamily: "var(--font-ui)",
        fontSize: "13px",
        fontWeight: 600,
        lineHeight: 1.4,
        padding: "4px 10px",
        borderRadius: "var(--radius-full)",
        ...v,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
