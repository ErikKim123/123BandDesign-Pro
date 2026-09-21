Wayfinding. `Tabs` switches festival categories or detail-page sections; `PromoBanner` is the black announcement strip above the nav.

```jsx
<PromoBanner ctaLabel="지금 예매 →" ctaHref="/buy" dismissible>
  🎟 얼리버드 패스 한정 판매 — 6월 30일까지
</PromoBanner>

<Tabs variant="segmented" items={[
  {value:"lineup",label:"라인업"},{value:"info",label:"안내"},{value:"map",label:"오시는 길"}
]} />

<Tabs variant="pill" items={[
  {value:"all",label:"전체"},{value:"edm",label:"EDM"},{value:"indie",label:"인디"}
]} />
```

Tabs are controlled (`value`/`onChange`) or uncontrolled (`defaultValue`).
