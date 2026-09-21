import React from "react";

const PADDING = {
  sm: "7px 14px",
  md: "10px 20px",
  lg: "13px 26px",
};

const FONT_SIZE = {
  sm: "13px",
  md: "14px",
  lg: "15px",
};

const VARIANTS = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--color-on-primary)",
    border: "1px solid transparent",
  },
  cream: {
    background: "var(--color-cream)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-beige-deep)",
  },
  dark: {
    background: "var(--color-ink)",
    color: "var(--color-on-dark)",
    border: "1px solid transparent",
  },
  secondary: {
    background: "transparent",
    color: "var(--color-ink)",
    border: "1px solid var(--color-hairline-strong)",
  },
  "on-cream": {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    border: "1px solid var(--color-beige-deep)",
  },
  link: {
    background: "transparent",
    color: "var(--color-primary)",
    border: "1px solid transparent",
    padding: "0",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
};

/**
 * Wolf primary action button. Sober editorial geometry — 8px radius, never a pill.
 */
export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  href,
  onClick,
  children,
  style,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isLink = variant === "link";

  const baseStyle = {
    display: fullWidth ? "flex" : "inline-flex",
    width: fullWidth ? "100%" : undefined,
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontFamily: "var(--font-ui)",
    fontSize: FONT_SIZE[size],
    fontWeight: 500,
    lineHeight: 1.3,
    padding: isLink ? "0" : PADDING[size],
    borderRadius: isLink ? "0" : "var(--radius-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard)",
    whiteSpace: "nowrap",
    textDecoration: v.textDecoration,
    textUnderlineOffset: v.textUnderlineOffset,
    ...v,
    ...(disabled
      ? {
          background: isLink ? "transparent" : "var(--color-hairline)",
          color: "var(--color-muted)",
          borderColor: "transparent",
          opacity: isLink ? 0.5 : 1,
        }
      : {}),
    ...style,
  };

  const content = (
    <>
      {leftIcon ? <span style={{ display: "inline-flex" }}>{leftIcon}</span> : null}
      {children}
      {rightIcon ? <span style={{ display: "inline-flex" }}>{rightIcon}</span> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <a href={href} style={baseStyle} onClick={onClick} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={disabled ? undefined : onClick} style={baseStyle} {...rest}>
      {content}
    </button>
  );
}
