import React from "react";

/**
 * Single-line text field. 44px height, hairline-strong border, orange focus ring.
 */
export function Input({ label, hint, error, id, style, wrapperStyle, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || (label ? "in-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", ...wrapperStyle }}>
      {label ? (
        <label
          htmlFor={inputId}
          style={{ fontFamily: "var(--font-ui)", fontSize: "14px", fontWeight: 500, color: "var(--color-ink)" }}
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        onFocus={(e) => { setFocused(true); rest.onFocus && rest.onFocus(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur && rest.onBlur(e); }}
        style={{
          height: "44px",
          fontFamily: "var(--font-ui)",
          fontSize: "16px",
          color: "var(--color-ink)",
          background: "var(--color-canvas)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          border: error
            ? "2px solid var(--color-primary-deep)"
            : focused
            ? "2px solid var(--color-primary)"
            : "1px solid var(--color-hairline-strong)",
          outline: "none",
          transition: "border-color var(--dur-fast) var(--ease-standard)",
          ...style,
        }}
        {...rest}
      />
      {error ? (
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: "var(--color-primary-deep)" }}>{error}</span>
      ) : hint ? (
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: "var(--color-steel)" }}>{hint}</span>
      ) : null}
    </div>
  );
}
