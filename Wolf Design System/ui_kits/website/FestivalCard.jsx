// Festival listing card — gradient "sky" media + meta + from-price
function FestivalCard({ festival, onOpen }) {
  const { Badge } = window.WolfDesignSystem_4d4911;
  const f = festival;
  return (
    <button onClick={() => onOpen(f)} style={{
      display: "flex", flexDirection: "column", textAlign: "left", padding: 0,
      background: "var(--color-canvas)", border: "1px solid var(--color-hairline-soft)",
      borderRadius: "var(--radius-lg)", overflow: "hidden", cursor: "pointer",
      transition: "box-shadow var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard)",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-2)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ position: "relative", aspectRatio: "16 / 10", background: f.sky }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,.35))" }} />
        {f.tag ? <div style={{ position: "absolute", top: 14, left: 14 }}><Badge variant="dark">{f.tag}</Badge></div> : null}
        <div style={{ position: "absolute", left: 16, bottom: 14 }}>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: 1, color: "rgba(255,255,255,.85)" }}>{f.en}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.05, color: "#fff" }}>{f.name}</div>
        </div>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--color-steel)", fontFamily: "var(--font-ui)", fontSize: 13 }}>
          <i data-lucide="calendar" style={{ width: 15, height: 15 }} /> {f.date}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--color-steel)", fontFamily: "var(--font-ui)", fontSize: 13 }}>
          <i data-lucide="map-pin" style={{ width: 15, height: 15 }} /> {f.location}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
          <span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-stone)" }}>from </span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, color: "var(--color-ink)" }}>{window.wolfWon(f.from)}</span>
          </span>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, color: "var(--color-primary)" }}>자세히 →</span>
        </div>
      </div>
    </button>
  );
}

Object.assign(window, { FestivalCard });
