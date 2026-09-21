// Checkout — order summary + cream contact/payment panel
function CheckoutScreen({ order, onConfirm, onNavigate }) {
  const { Input, Select, Button, Card } = window.WolfDesignSystem_4d4911;
  const [qty, setQty] = React.useState(1);

  if (!order) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-section-lg) var(--container-gutter)", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 44, letterSpacing: -1, color: "var(--color-ink)", fontWeight: 400 }}>장바구니가 비어있어요</h1>
        <p style={{ fontFamily: "var(--font-ui)", color: "var(--color-steel)", marginBottom: 24 }}>마음에 드는 페스티벌의 패스를 먼저 골라보세요.</p>
        <Button variant="primary" size="lg" onClick={() => onNavigate("browse")}>페스티벌 둘러보기</Button>
      </div>
    );
  }

  const { festival, pass, price } = order;
  const subtotal = price * qty;
  const fee = Math.round(subtotal * 0.03);
  const total = subtotal + fee;

  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--space-section) var(--container-gutter)" }}>
      <h1 style={{ margin: "0 0 32px", fontFamily: "var(--font-display)", fontSize: 52, letterSpacing: -1, color: "var(--color-ink)", fontWeight: 400 }}>예매하기</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32, alignItems: "start" }}>
        {/* Summary */}
        <Card variant="base" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 120, background: festival.sky }} />
          <div style={{ padding: 28 }}>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, letterSpacing: 1, color: "var(--color-stone)" }}>{festival.en}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--color-ink)", margin: "2px 0 4px" }}>{festival.name}</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--color-steel)", marginBottom: 24 }}>{festival.date} · {festival.location}</div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderTop: "1px solid var(--color-hairline)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>{pass.name}</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--color-steel)" }}>{window.wolfWon(price)} {pass.cadence}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} style={qtyBtn}>−</button>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, minWidth: 18, textAlign: "center" }}>{qty}</span>
                <button onClick={() => setQty(qty + 1)} style={qtyBtn}>+</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 16, borderTop: "1px solid var(--color-hairline)" }}>
              <Row label="패스 금액" value={window.wolfWon(subtotal)} />
              <Row label="예매 수수료" value={window.wolfWon(fee)} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>총 결제금액</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 34, letterSpacing: -1, color: "var(--color-primary)" }}>{window.wolfWon(total)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Payment panel (cream) */}
        <div style={{ background: "var(--color-cream)", border: "1px solid var(--color-beige-deep)", borderRadius: "var(--radius-lg)", padding: 32 }}>
          <h2 style={{ margin: "0 0 20px", fontFamily: "var(--font-ui)", fontSize: 22, fontWeight: 600, color: "var(--color-ink)" }}>예매자 정보</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="이름" placeholder="홍길동" style={{ background: "#fff" }} />
            <Input label="이메일" placeholder="you@example.com" hint="전자 패스가 이 메일로 발송됩니다" style={{ background: "#fff" }} />
            <Input label="휴대폰 번호" placeholder="010-0000-0000" style={{ background: "#fff" }} />
            <Select label="결제 방법" style={{ background: "#fff" }} options={[
              { value: "card", label: "신용 / 체크카드" },
              { value: "kakao", label: "카카오페이" },
              { value: "naver", label: "네이버페이" },
              { value: "toss", label: "토스페이" },
            ]} />
            <Button variant="dark" size="lg" fullWidth onClick={() => onConfirm({ festival, pass, price, qty, total })} style={{ marginTop: 8 }}>
              {window.wolfWon(total)} 결제하기
            </Button>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-steel)", textAlign: "center", margin: 0 }}>결제 시 이용약관 및 환불 정책에 동의하게 됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--color-slate)" }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

const qtyBtn = {
  width: 32, height: 32, borderRadius: "var(--radius-md)", border: "1px solid var(--color-hairline-strong)",
  background: "#fff", cursor: "pointer", fontSize: 18, color: "var(--color-ink)", lineHeight: 1,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

Object.assign(window, { CheckoutScreen });
