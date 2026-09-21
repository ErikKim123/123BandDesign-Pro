Containers and callouts. `Card` is the generic surface (6 variants); `PassCard` is the festival pass-tier pricing card; `StatCell` is the editorial number callout.

```jsx
<Card variant="feature">…</Card>
<Card variant="cream">…</Card>

<PassCard name="3-DAY PASS" price="₩290,000" cadence="/ 3일권"
  badge="BEST VALUE" featured
  perks={["전 스테이지 입장","전용 라운지","굿즈 키트"]} onSelect={buy} />

<StatCell value="120K+" label="누적 관객" />
```

Card variants: `base` · `feature` · `cream` · `cream-soft` · `product` (shadow) · `photographic` (dark, image-fill).
