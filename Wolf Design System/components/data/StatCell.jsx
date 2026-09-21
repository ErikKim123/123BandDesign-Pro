import React from "react";

/**
 * Editorial stat callout. Big number in PP-Editorial-substitute display face.
 */
export function StatCell({ value, label, align = "left", style, ...rest }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "var(--space-lg)", textAlign: align, alignItems: align === "center" ? "center" : "flex-start", ...style }} {...rest}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: "56px", lineHeight: 1.1, letterSpacing: "-1px", color: "var(--color-ink)" }}>
        {value}
      </span>
      {label ? (
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "14px", color: "var(--color-steel)", maxWidth: "22ch" }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
