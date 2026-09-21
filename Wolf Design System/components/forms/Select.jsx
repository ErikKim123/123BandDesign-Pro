import React from "react";

/**
 * Native select styled to match Input. Pass options as [{value,label}] or children.
 */
export function Select({ label, hint, id, options, children, style, wrapperStyle, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || (label ? "sel-" + label.replace(/\s+/g, "-").toLowerCase() : undefined);
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
      <div style={{ position: "relative", display: "flex" }}>
        <select
          id={inputId}
          onFocus={(e) => { setFocused(true); rest.onFocus && rest.onFocus(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur && rest.onBlur(e); }}
          style={{
            width: "100%",
            height: "44px",
            appearance: "none",
            WebkitAppearance: "none",
            fontFamily: "var(--font-ui)",
            fontSize: "16px",
            color: "var(--color-ink)",
            background: "var(--color-canvas)",
            borderRadius: "var(--radius-md)",
            padding: "12px 40px 12px 16px",
            border: focused ? "2px solid var(--color-primary)" : "1px solid var(--color-hairline-strong)",
            outline: "none",
            cursor: "pointer",
            ...style,
          }}
          {...rest}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
        <span
          style={{
            position: "absolute",
            right: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--color-steel)",
            fontSize: "12px",
          }}
        >
          ▾
        </span>
      </div>
      {hint ? (
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: "var(--color-steel)" }}>{hint}</span>
      ) : null}
    </div>
  );
}
