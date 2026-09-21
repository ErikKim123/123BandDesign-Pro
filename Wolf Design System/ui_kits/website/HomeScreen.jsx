// Homepage — hero, featured festivals, stats, closing CTA
function HomeScreen({ onNavigate, onOpenFestival }) {
  const { HeroBand, Button, StatCell, CtaBanner } = window.WolfDesignSystem_4d4911;
  const featured = window.WOLF_FESTIVALS;
  return (
    <div>
      <HeroBand
        eyebrow="2026 SUMMER — AUTUMN"
        title={<>해가 지면,<br />무대가 깨어난다.</>}
        subtitle="세상의 모든 페스티벌을 한 장의 패스로. 검색하고, 비교하고, 한 번에 예매하세요."
        actions={<>
          <Button variant="dark" size="lg" onClick={() => onNavigate("browse")}>패스 둘러보기</Button>
          <Button variant="secondary" size="lg" onClick={() => onOpenFestival(featured[0])}>라인업 보기</Button>
        </>}
        media={<div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg,#ff8a00,#fa520f 50%,#cc3a05)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,.45), transparent 45%)" }} />
        </div>}
      />

      {/* Featured */}
      <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--space-section-lg) var(--container-gutter)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--color-stone)", marginBottom: 10 }}>이번 시즌 라인업</div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 52, lineHeight: 1.1, letterSpacing: -1, color: "var(--color-ink)", fontWeight: 400 }}>곧 만날 무대들</h2>
          </div>
          <button onClick={() => onNavigate("browse")} style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer" }}>전체 보기 →</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {featured.map((f) => <window.FestivalCard key={f.id} festival={f} onOpen={onOpenFestival} />)}
        </div>
      </section>

      {/* Stats band on cream */}
      <section style={{ background: "var(--color-cream)" }}>
        <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--space-section) var(--container-gutter)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          <StatCell value="120K+" label="누적 관객" />
          <StatCell value="48" label="라인업 아티스트" />
          <StatCell value="12" label="전국 페스티벌" />
          <StatCell value="99.4%" label="입장 성공률" />
        </div>
      </section>

      <CtaBanner withStripe
        title="다음 무대는 당신 차례."
        subtitle="얼리버드 패스는 한정 수량입니다. 노을이 지기 전에 예매하세요."
        actions={<window.WolfDesignSystem_4d4911.Button variant="primary" size="lg" onClick={() => onNavigate("browse")}>지금 예매</window.WolfDesignSystem_4d4911.Button>}
      />
    </div>
  );
}

Object.assign(window, { HomeScreen });
