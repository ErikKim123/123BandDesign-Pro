import React from "react";
import { SunsetStripe } from "./SunsetStripe.jsx";

const DEFAULT_COLUMNS = [
  { heading: "둘러보기", links: ["전체 페스티벌", "이번 주말", "지역별", "장르별"] },
  { heading: "패스", links: ["1-DAY", "3-DAY", "VIP", "단체 예매"] },
  { heading: "고객지원", links: ["자주 묻는 질문", "환불 정책", "문의하기", "공지사항"] },
  { heading: "회사", links: ["브랜드 소개", "채용", "제휴 문의", "약관"] },
];

/**
 * Cream multi-column footer, preceded by the signature sunset stripe.
 * The closing element of every Wolf page.
 */
export function Footer({ wordmark = "WOLF", tagline = "세상의 모든 페스티벌, 한 장의 패스로.", columns = DEFAULT_COLUMNS, style, ...rest }) {
  return (
    <footer style={{ width: "100%", ...style }} {...rest}>
      <SunsetStripe />
      <div style={{ background: "var(--color-footer-cream)", color: "var(--color-ink)" }}>
        <div
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            padding: "var(--space-section) var(--container-gutter)",
            display: "grid",
            gridTemplateColumns: "1.4fr repeat(4, 1fr)",
            gap: "var(--space-xxxl)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "32px", letterSpacing: "0.5px", color: "var(--color-ink)" }}>
              {wordmark}
            </span>
            <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: "14px", lineHeight: 1.5, color: "var(--color-slate)", maxWidth: "26ch" }}>
              {tagline}
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.heading} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 600, color: "var(--color-ink)" }}>
                {col.heading}
              </span>
              {col.links.map((l) => (
                <a
                  key={l}
                  href="#"
                  style={{ fontFamily: "var(--font-ui)", fontSize: "14px", color: "var(--color-primary)", textDecoration: "none", padding: "4px 0" }}
                >
                  {l}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div
          style={{
            maxWidth: "var(--container-max)",
            margin: "0 auto",
            padding: "0 var(--container-gutter) var(--space-section)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            fontFamily: "var(--font-ui)",
            fontSize: "12px",
            color: "var(--color-steel)",
          }}
        >
          <span>© 2026 Wolf Festival Pass. All rights reserved.</span>
          <span style={{ display: "flex", gap: "16px" }}>
            <a href="#" style={{ color: "var(--color-steel)", textDecoration: "none" }}>Instagram</a>
            <a href="#" style={{ color: "var(--color-steel)", textDecoration: "none" }}>YouTube</a>
            <a href="#" style={{ color: "var(--color-steel)", textDecoration: "none" }}>한국어 ▾</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
