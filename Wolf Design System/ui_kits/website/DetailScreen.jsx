// Festival detail — hero banner, tabs (lineup/info/map), pass tiers
function DetailScreen({ festival, onSelectPass }) {
  const { Tabs, Badge, PassCard, Card } = window.WolfDesignSystem_4d4911;
  const f = festival;
  const [tab, setTab] = React.useState("lineup");

  return (
    <div>
      {/* Hero */}
      <section style={{ position: "relative", background: f.sky }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 30%,rgba(0,0,0,.45))" }} />
        <div style={{ position: "relative", maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--space-section-lg) var(--container-gutter) var(--space-section)", color: "#fff" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Badge variant="orange">{f.genre}</Badge>
            {f.tag ? <Badge variant="dark">{f.tag}</Badge> : null}
          </div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, letterSpacing: 1, color: "rgba(255,255,255,.85)", marginBottom: 8 }}>{f.en}</div>
          <h1 style={{ margin: "0 0 18px", fontFamily: "var(--font-display)", fontSize: 76, lineHeight: 1.05, letterSpacing: -1.5, fontWeight: 400 }}>{f.name}</h1>
          <div style={{ display: "flex", gap: 24, fontFamily: "var(--font-ui)", fontSize: 15 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i data-lucide="calendar" style={{ width: 18, height: 18 }} /> {f.date}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i data-lucide="map-pin" style={{ width: 18, height: 18 }} /> {f.location}</span>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--space-section) var(--container-gutter)" }}>
        <Tabs value={tab} onChange={setTab} items={[
          { value: "lineup", label: "라인업" },
          { value: "info", label: "안내" },
          { value: "map", label: "오시는 길" },
        ]} style={{ marginBottom: 32 }} />

        {tab === "lineup" && (
          <div>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 18, lineHeight: 1.5, color: "var(--color-slate)", maxWidth: "56ch", marginTop: 0 }}>{f.blurb}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 24 }}>
              {f.lineup.map((a, i) => (
                <Card key={a} variant="base" style={{ display: "flex", alignItems: "center", gap: 14, padding: 18 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--color-primary)", minWidth: 34 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 17, fontWeight: 600, color: "var(--color-ink)" }}>{a}</span>
                </Card>
              ))}
            </div>
          </div>
        )}
        {tab === "info" && (
          <Card variant="cream-soft" style={{ maxWidth: 720 }}>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 16, lineHeight: 1.7, color: "var(--color-slate)", margin: 0 }}>
              · 입장: 게이트 오픈 14:00 / 공연 시작 16:00<br />
              · 재입장: 3-DAY 이상 패스 소지 시 가능<br />
              · 우천 시에도 정상 진행되며, 천재지변 외 환불은 불가합니다.<br />
              · 만 19세 미만은 보호자 동반이 필요합니다.
            </p>
          </Card>
        )}
        {tab === "map" && (
          <Card variant="base" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ height: 320, background: "linear-gradient(135deg,#fff0c2,#ffd06a)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-ink-tint)", fontFamily: "var(--font-ui)", gap: 8 }}>
              <i data-lucide="map-pin" style={{ width: 22, height: 22 }} /> {f.location}
            </div>
          </Card>
        )}

        {/* Pass tiers */}
        <div style={{ marginTop: 64 }}>
          <h2 style={{ margin: "0 0 28px", fontFamily: "var(--font-display)", fontSize: 44, letterSpacing: -1, color: "var(--color-ink)", fontWeight: 400 }}>패스 선택</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, alignItems: "stretch", paddingTop: 14 }}>
            {window.WOLF_PASSES.map((p) => {
              const price = Math.round((f.from * p.mult) / 1000) * 1000;
              return (
                <PassCard key={p.id} name={p.name} price={window.wolfWon(price)} cadence={p.cadence}
                  description={p.desc} badge={p.badge} featured={p.featured} perks={p.perks}
                  cta="패스 구매" onSelect={() => onSelectPass(f, p, price)} />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { DetailScreen });
