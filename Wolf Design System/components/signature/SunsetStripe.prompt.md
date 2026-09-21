The Wolf brand recognizers — use these to give any page its signature.

- **`SunsetStripe`** — the orange→yellow→cream gradient band. Place it directly above the footer on every page. It's the #1 brand element.
- **`HeroBand`** — atmospheric sunset hero. Editorial display headline left, optional `media` panel right.
- **`CtaBanner`** — cream closing CTA band ("다음 무대는 당신 차례.").
- **`Footer`** — cream multi-column footer (includes its own SunsetStripe).

```jsx
<HeroBand eyebrow="2026 SUMMER" title={<>해가 지면,<br/>무대가 깨어난다.</>}
  subtitle="세상의 모든 페스티벌을 한 장의 패스로."
  actions={<><Button variant="dark" size="lg">패스 구매</Button><Button variant="secondary" size="lg">라인업 보기</Button></>}
  media={<div style={{width:'100%',height:'100%',background:'var(--sunset-sky)'}}/>} />

<CtaBanner withStripe title="다음 무대는 당신 차례." actions={<Button variant="primary" size="lg">지금 예매</Button>} />
<Footer />
```

Never drop the sunset stripe from a page bottom — it's the brand's continuity element.
