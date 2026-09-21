The Wolf action button — use for any primary or secondary call-to-action. Saturated-orange `primary` is the dominant action; reach for `dark` on cream surfaces, `secondary`/`on-cream` for lower emphasis, and `link` for inline text actions.

```jsx
<Button variant="primary" onClick={buy}>패스 구매</Button>
<Button variant="dark" size="lg">티켓 보기</Button>
<Button variant="secondary">자세히</Button>
<Button variant="link" href="/festivals">전체 보기 →</Button>
```

Variants: `primary` · `cream` · `dark` · `secondary` · `on-cream` · `link`. Sizes: `sm` · `md` · `lg`. Props: `disabled`, `fullWidth`, `leftIcon`, `rightIcon`, `href`. Geometry is sober — 8px radius, never `--radius-full`.
