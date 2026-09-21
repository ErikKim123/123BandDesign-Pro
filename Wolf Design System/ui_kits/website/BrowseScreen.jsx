// Browse / listing — header, filter bar, festival grid
function BrowseScreen({ onOpenFestival }) {
  const { Tabs, Select } = window.WolfDesignSystem_4d4911;
  const [genre, setGenre] = React.useState("all");
  const all = window.WOLF_FESTIVALS;
  const list = genre === "all" ? all : all.filter((f) => f.genre === genre);

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--space-section) var(--container-gutter)" }}>
      <div style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--color-stone)", marginBottom: 10 }}>FESTIVALS</div>
      <h1 style={{ margin: "0 0 28px", fontFamily: "var(--font-display)", fontSize: 56, lineHeight: 1.1, letterSpacing: -1, color: "var(--color-ink)", fontWeight: 400 }}>전체 페스티벌</h1>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <Tabs variant="pill" value={genre} onChange={setGenre} items={[
          { value: "all", label: "전체" },
          { value: "EDM", label: "EDM" },
          { value: "인디", label: "인디" },
          { value: "힙합", label: "힙합" },
          { value: "록", label: "록" },
        ]} />
        <div style={{ display: "flex", gap: 12 }}>
          <Select options={[{ value: "all", label: "전 지역" }, { value: "seoul", label: "서울/경기" }, { value: "busan", label: "부산" }]} wrapperStyle={{ minWidth: 140 }} />
          <Select options={[{ value: "soon", label: "다가오는 순" }, { value: "price", label: "가격 낮은 순" }, { value: "pop", label: "인기순" }]} wrapperStyle={{ minWidth: 150 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {list.map((f) => <window.FestivalCard key={f.id} festival={f} onOpen={onOpenFestival} />)}
      </div>
    </div>
  );
}

Object.assign(window, { BrowseScreen });
