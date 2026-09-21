import React from "react";
import { SunsetStripe } from "./SunsetStripe.jsx";

/**
 * Cream-tinted page CTA band. "다음 무대는 당신 차례." editorial headline + actions.
 * Set `withStripe` to prepend the signature sunset stripe.
 */
export function CtaBanner({ title, subtitle, actions, withStripe = false, style, ...rest }) {
  return (
    <div style={{ width: "100%" }}>
      {withStripe ? <SunsetStripe /> : null}
      <section
        style={{
          background: "var(--color-cream)",
          color: "var(--color-ink)",
          ...style,
        }}
        {...rest}
      >
        <div
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            padding: "var(--space-section-lg) var(--container-gutter)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "var(--space-lg)",
          }}
        >
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "52px", lineHeight: 1.15, letterSpacing: "-0.5px", fontWeight: 400, maxWidth: "16ch" }}>
            {title}
          </h2>
          {subtitle ? (
            <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: "18px", lineHeight: 1.5, color: "var(--color-slate)", maxWidth: "48ch" }}>
              {subtitle}
            </p>
          ) : null}
          {actions ? <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "8px" }}>{actions}</div> : null}
        </div>
      </section>
    </div>
  );
}
