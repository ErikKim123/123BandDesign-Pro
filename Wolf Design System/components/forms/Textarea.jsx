import React from "react";

/**
 * Multi-line text area. Matches Input styling; min 3 rows.
 */
export function Textarea({ label, hint, id, rows = 4, style, wrapperStyle, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || (label ? "ta-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
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
      <textarea
        id={inputId}
        rows={rows}
        onFocus={(e) => { setFocused(true); rest.onFocus && rest.onFocus(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur && rest.onBlur(e); }}
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "16px",
          lineHeight: 1.55,
          color: "var(--color-ink)",
          background: "var(--color-canvas)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          resize: "vertical",
          border: focused ? "2px solid var(--color-primary)" : "1px solid var(--color-hairline-strong)",
          outline: "none",
          transition: "border-color var(--dur-fast) var(--ease-standard)",
          ...style,
        }}
        {...rest}
      />
      {hint ? (
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: "var(--color-steel)" }}>{hint}</span>
      ) : null}
    </div>
  );
}
