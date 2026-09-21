// My Passes wallet — dark ticket card with a (faux) QR + order details
function WalletScreen({ ticket, onNavigate }) {
  const { Badge, Button } = window.WolfDesignSystem_4d4911;

  if (!ticket) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-section-lg) var(--container-gutter)", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 44, letterSpacing: -1, color: "var(--color-ink)", fontWeight: 400 }}>아직 패스가 없어요</h1>
        <p style={{ fontFamily: "var(--font-ui)", color: "var(--color-steel)", marginBottom: 24 }}>첫 페스티벌 패스를 예매하면 이곳에 보관됩니다.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate("browse")}>페스티벌 둘러보기</Button>
      </div>
    );
  }

  const { festival, pass, qty, orderId } = ticket;
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "var(--space-section) var(--container-gutter)" }}>
      <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--color-stone)", marginBottom: 10 }}>MY PASSES</div>
      <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: 52, letterSpacing: -1, color: "var(--color-ink)", fontWeight: 400 }}>내 패스</h1>
      <p style={{ fontFamily: "var(--font-ui)", color: "var(--color-steel)", marginTop: 0, marginBottom: 32 }}>예매가 완료되었습니다. 입장 게이트에서 QR을 스캔하세요.</p>

      {/* Ticket card */}
      <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-3)", background: "var(--color-surface-code)" }}>
        <div style={{ height: 8, background: "var(--sunset-stripe)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, padding: 32, color: "#fff" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, letterSpacing: 1, color: "var(--color-sunshine-500)" }}>{festival.en}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 38, lineHeight: 1.05 }}>{festival.name}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Badge variant="orange">{pass.name}</Badge>
              <Badge variant="dark">x{qty}</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-ui)", fontSize: 14, color: "rgba(255,255,255,.75)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i data-lucide="calendar" style={{ width: 16, height: 16 }} /> {festival.date}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i data-lucide="map-pin" style={{ width: 16, height: 16 }} /> {festival.location}</span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-on-dark-muted)", marginTop: 4 }}>
              ORDER #{orderId}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <FauxQR seed={orderId} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-on-dark-muted)" }}>SCAN AT GATE</span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Button variant="secondary" onClick={() => onNavigate("home")}>홈으로</Button>
        <Button variant="primary" onClick={() => onNavigate("browse")}>다른 페스티벌 보기</Button>
      </div>
    </div>
  );
}

// Deterministic faux-QR rendered as a CSS grid (no external dependency)
function FauxQR({ seed = "WOLF" }) {
  const n = 21;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const cells = [];
  for (let i = 0; i < n * n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push((h >> 16) & 1);
  }
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: "var(--radius-md)" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 7px)`, gridAutoRows: "7px" }}>
        {cells.map((v, i) => {
          const r = Math.floor(i / n), c = i % n;
          const on = finder(r, c) ? true : v === 1;
          return <div key={i} style={{ width: 7, height: 7, background: on ? "#1c1c1e" : "#fff" }} />;
        })}
      </div>
    </div>
  );
}

Object.assign(window, { WalletScreen });
