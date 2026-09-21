import React from "react";
import { Button } from "../core/Button.jsx";
import { Badge } from "../core/Badge.jsx";

/**
 * Festival pass tier card. `featured` swaps to cream + orange border.
 * Perks render as a checklist; CTA spans the footer.
 */
export function PassCard({
  name,
  price,
  cadence = "",
  description,
  perks = [],
  featured = false,
  badge,
  cta = "패스 구매",
  onSelect,
  style,
  ...rest
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-xxl)",
        background: featured ? "var(--color-cream)" : "var(--color-canvas)",
        border: featured ? "2px solid var(--color-primary)" : "1px solid var(--color-hairline-soft)",
        position: "relative",
        ...style,
      }}
      {...rest}
    >
      {badge ? (
        <div style={{ position: "absolute", top: "-12px", left: "var(--space-xxl)" }}>
          <Badge variant={featured ? "orange" : "dark"}>{badge}</Badge>
        </div>
      ) : null}

      <div>
        <div style={{ fontFamily: "var(--font-ui)", fontSize: "18px", fontWeight: 600, color: "var(--color-ink)" }}>
          {name}
        </div>
        {description ? (
          <div style={{ fontFamily: "var(--font-ui)", fontSize: "14px", color: "var(--color-steel)", marginTop: "4px" }}>
            {description}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "56px", lineHeight: 1, letterSpacing: "-1px", color: "var(--color-ink)" }}>
          {price}
        </span>
        {cadence ? (
          <span style={{ fontFamily: "var(--font-ui)", fontSize: "14px", color: "var(--color-steel)" }}>{cadence}</span>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        {perks.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <span style={{ color: "var(--color-primary)", fontWeight: 700, lineHeight: "1.55", flexShrink: 0 }}>✓</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "14px", lineHeight: 1.55, color: "var(--color-slate)" }}>{p}</span>
          </div>
        ))}
      </div>

      <Button variant={featured ? "primary" : "dark"} fullWidth onClick={onSelect}>
        {cta}
      </Button>
    </div>
  );
}
