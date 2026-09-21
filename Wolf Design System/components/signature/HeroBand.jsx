import React from "react";

/**
 * Atmospheric sunset hero band. Headline left in the editorial display face,
 * subtitle + action row beneath; an atmospheric sunset-sky panel on the right.
 * Pass `media` (e.g. an <image-slot> or <img>) to fill the right panel.
 */
export function HeroBand({ eyebrow, title, subtitle, actions, media, style, ...rest }) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--sunset-sky)",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          maxWidth: "var(--container-max)",
          margin: "0 auto",
          padding: "var(--space-hero) var(--container-gutter)",
          display: "grid",
          gridTemplateColumns: media ? "minmax(0, 1.1fr) minmax(0, 0.9fr)" : "1fr",
          gap: "var(--space-xxxl)",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)", maxWidth: "640px" }}>
          {eyebrow ? (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: "var(--color-ink-tint)" }}>
              {eyebrow}
            </span>
          ) : null}
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "84px", lineHeight: 1.05, letterSpacing: "-1.5px", color: "var(--color-ink)", fontWeight: 400 }}>
            {title}
          </h1>
          {subtitle ? (
            <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: "18px", lineHeight: 1.5, color: "var(--color-ink-tint)", maxWidth: "48ch" }}>
              {subtitle}
            </p>
          ) : null}
          {actions ? <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "8px" }}>{actions}</div> : null}
        </div>
        {media ? (
          <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", aspectRatio: "4 / 3", boxShadow: "var(--shadow-3)" }}>
            {media}
          </div>
        ) : null}
      </div>
    </section>
  );
}
