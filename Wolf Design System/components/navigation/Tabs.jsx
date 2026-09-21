import React from "react";

/**
 * Tab navigation. `variant="segmented"` = underline tabs (orange active border);
 * `variant="pill"` = pill tabs (ink active). Controlled via value/onChange or uncontrolled.
 */
export function Tabs({ items = [], value, defaultValue, onChange, variant = "segmented", style, ...rest }) {
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = value !== undefined ? value : internal;
  const select = (v) => {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  };

  if (variant === "pill") {
    return (
      <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap", ...style }} {...rest}>
        {items.map((it) => {
          const on = it.value === active;
          return (
            <button
              key={it.value}
              type="button"
              onClick={() => select(it.value)}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "14px",
                fontWeight: 500,
                padding: "8px 16px",
                borderRadius: "var(--radius-full)",
                cursor: "pointer",
                transition: "all var(--dur-fast) var(--ease-standard)",
                background: on ? "var(--color-ink)" : "var(--color-canvas)",
                color: on ? "var(--color-on-dark)" : "var(--color-steel)",
                border: on ? "1px solid var(--color-ink)" : "1px solid var(--color-hairline)",
              }}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        borderBottom: "1px solid var(--color-hairline)",
        ...style,
      }}
      {...rest}
    >
      {items.map((it) => {
        const on = it.value === active;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => select(it.value)}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "14px",
              fontWeight: 500,
              padding: "12px 16px",
              background: "transparent",
              cursor: "pointer",
              border: "none",
              borderBottom: on ? "2px solid var(--color-primary)" : "2px solid transparent",
              marginBottom: "-1px",
              color: on ? "var(--color-primary)" : "var(--color-steel)",
              transition: "color var(--dur-fast) var(--ease-standard)",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
