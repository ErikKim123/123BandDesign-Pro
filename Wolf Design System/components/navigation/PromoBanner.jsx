import React from "react";

/**
 * Sticky black promo strip that sits ABOVE the top nav. One-line copy + inline CTA.
 */
export function PromoBanner({ children, ctaLabel, onCta, ctaHref, dismissible = false, style, ...rest }) {
  const [open, setOpen] = React.useState(true);
  if (!open) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: "var(--color-ink)",
        color: "var(--color-on-dark)",
        fontFamily: "var(--font-ui)",
        fontSize: "14px",
        fontWeight: 500,
        padding: "12px 16px",
        position: "relative",
        ...style,
      }}
      {...rest}
    >
      <span>{children}</span>
      {ctaLabel ? (
        <a
          href={ctaHref || "#"}
          onClick={onCta}
          style={{
            color: "var(--color-sunshine-500)",
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {ctaLabel}
        </a>
      ) : null}
      {dismissible ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="닫기"
          style={{
            position: "absolute",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "var(--color-on-dark-muted)",
            cursor: "pointer",
            fontSize: "16px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
