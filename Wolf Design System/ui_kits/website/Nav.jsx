// Wolf top navigation: promo banner + sticky white bar
function WolfNav({ route, onNavigate, cartCount = 0 }) {
  const { PromoBanner } = window.WolfDesignSystem_4d4911;
  const links = [
    { id: "browse", label: "페스티벌" },
    { id: "home", label: "라인업" },
    { id: "home", label: "안내" },
  ];
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
      <PromoBanner ctaLabel="지금 예매 →" ctaHref="#" onCta={(e) => { e.preventDefault(); onNavigate("browse"); }} dismissible>
        🎟 얼리버드 패스 한정 판매 — 6월 30일 마감
      </PromoBanner>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, padding: "0 32px", background: "var(--color-canvas)",
        borderBottom: "1px solid var(--color-hairline-soft)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <button onClick={() => onNavigate("home")} style={{
            display: "flex", alignItems: "center", gap: 10, background: "none",
            border: "none", cursor: "pointer", padding: 0,
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "linear-gradient(180deg,#ff8a00,#fa520f 55%,#cc3a05)",
            }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 0.5, color: "var(--color-ink)", lineHeight: 1 }}>WOLF</span>
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {links.map((l, i) => (
              <button key={i} onClick={() => onNavigate(l.id)} style={{
                fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 500,
                color: "var(--color-slate)", background: "none", border: "none",
                cursor: "pointer", padding: "6px 10px",
              }}>{l.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button aria-label="검색" style={iconBtn}><i data-lucide="search" style={{ width: 20, height: 20 }} /></button>
          <button onClick={() => onNavigate("wallet")} style={{
            display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--font-ui)",
            fontSize: 14, fontWeight: 500, color: route === "wallet" ? "var(--color-primary)" : "var(--color-ink)",
            background: "none", border: "none", cursor: "pointer",
          }}>
            <i data-lucide="ticket" style={{ width: 18, height: 18 }} /> 내 패스
          </button>
          <button onClick={() => onNavigate("checkout")} style={{ ...iconBtn, position: "relative" }} aria-label="장바구니">
            <i data-lucide="shopping-bag" style={{ width: 20, height: 20 }} />
            {cartCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -6, minWidth: 16, height: 16,
                padding: "0 4px", borderRadius: 999, background: "var(--color-primary)",
                color: "#fff", fontSize: 10, fontWeight: 700, display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>{cartCount}</span>
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}

const iconBtn = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 36, height: 36, background: "none", border: "none", cursor: "pointer",
  color: "var(--color-ink)",
};

Object.assign(window, { WolfNav });
