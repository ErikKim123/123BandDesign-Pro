// Wolf website — app shell wiring all screens together
function WolfApp() {
  const { Footer } = window.WolfDesignSystem_4d4911;
  const [route, setRoute] = React.useState("home");
  const [festival, setFestival] = React.useState(null);
  const [order, setOrder] = React.useState(null);
  const [ticket, setTicket] = React.useState(null);

  const go = (r) => { setRoute(r); window.scrollTo({ top: 0 }); };
  const openFestival = (f) => { setFestival(f); go("detail"); };
  const selectPass = (f, p, price) => { setOrder({ festival: f, pass: p, price }); go("checkout"); };
  const confirm = (o) => {
    const orderId = "2026-" + String(Math.floor(Math.random() * 9000000) + 1000000);
    setTicket({ ...o, orderId });
    go("wallet");
  };

  // re-render Lucide icons whenever the screen changes
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const cartCount = order && route !== "wallet" ? 1 : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-canvas)", display: "flex", flexDirection: "column" }}>
      <window.WolfNav route={route} onNavigate={go} cartCount={cartCount} />
      <main style={{ flex: 1 }}>
        {route === "home" && <window.HomeScreen onNavigate={go} onOpenFestival={openFestival} />}
        {route === "browse" && <window.BrowseScreen onOpenFestival={openFestival} />}
        {route === "detail" && <window.DetailScreen festival={festival} onSelectPass={selectPass} />}
        {route === "checkout" && <window.CheckoutScreen order={order} onConfirm={confirm} onNavigate={go} />}
        {route === "wallet" && <window.WalletScreen ticket={ticket} onNavigate={go} />}
      </main>
      <Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<WolfApp />);
