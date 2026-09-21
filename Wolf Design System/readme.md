# Wolf Design System

**Wolf** is a festival-pass marketplace — *세상의 모든 페스티벌을 한 장의 패스로* ("every festival in the world, on a single pass"). Users browse music festivals, compare pass tiers (1-DAY / 3-DAY / VIP), and check out in one place; passes live in an in-app wallet with a QR code.

The brand runs on a single cinematic signature: **the sunset.** Atmospheric orange-yellow gradient skies, warm cream surfaces, an editorial near-serif voice, and — above every footer — a horizontal **sunset stripe** band (orange → yellow → cream). That stripe is the #1 recognizer; it closes every page. The geometry is sober and editorial (8px buttons, 12px cards, pills reserved for badges), which keeps a festival product feeling premium rather than novelty.

---

## Sources & provenance

This system was built from a written brand analysis (a "Mistral AI" design spec) supplied as the visual reference, **re-skinned as the Wolf festival brand**. No codebase, Figma, or screenshots were attached — there is no upstream repo or design file to link. If a Wolf codebase or Figma exists, attach it via the Import menu and this system can be reconciled against it.

**Substitutions to confirm (see Known Gaps):**
- **Display font** — the reference calls for *PP Editorial Old* (paid, un-bundleable). Substituted with **Instrument Serif** (Google Fonts), the closest free editorial near-serif. Swap in the real files when available.
- **UI font** — **Pretendard** (via jsDelivr CDN) is used for Korean + Latin UI text, replacing Inter so Korean copy renders correctly. This is an intentional, brand-appropriate choice for a Korean product.
- **Icons** — **Lucide** (CDN) substitutes for an unknown icon set (see Iconography).

---

## Content fundamentals

**Language & voice.** Primary language is **Korean**, with English used for typographic accents (pass-tier names like `3-DAY PASS`, eyebrows like `2026 SUMMER LINEUP`, the `WOLF` wordmark). The voice is warm, confident, and a touch poetic — festival anticipation, not corporate SaaS.

**Tone & casing.**
- Headlines lean evocative and editorial: *"해가 지면, 무대가 깨어난다."* ("When the sun sets, the stage wakes up."), *"다음 무대는 당신 차례."* ("The next stage is your turn."). Set in the serif display face.
- Body copy is plain, helpful, second-person — speaks to *you* (당신/–하세요 polite imperative), never "users."
- English accents are **UPPERCASE** for eyebrows and pass names; Korean headlines are sentence case.
- Pass/CTA labels are short imperatives: `패스 구매`, `지금 예매`, `라인업 보기`, `전체 보기 →`.

**Numbers & stats.** Big editorial stat callouts in the serif display face — `120K+ 누적 관객`, `48 라인업 아티스트`, `3일`. Currency is Korean Won with comma grouping: `₩290,000`.

**Emoji.** Used **sparingly** — a single 🎟 in the promo banner is on-brand; avoid emoji in headings, body, or as decorative bullets. Perk checklists use an orange `✓`, not emoji.

**Vibe.** Golden hour. Anticipation. The minutes before the headliner. Warm, premium, unhurried.

---

## Visual foundations

**Color.** A warm sunset system, no cool tones.
- **Primary** is Wolf orange `#fa520f` — reserved for primary CTAs, active states, links, and the sunset stripe. Pressed deepens to `#cc3a05`. Do **not** introduce accent colors outside the orange/yellow/cream family.
- **Sunshine spectrum** (`#ff8a00 → #ffd06a` + saturated yellow `#ffd900`) builds the atmospheric hero skies and the sunset stripe gradient.
- **Cream surfaces** (`#fff8e0`, `#fffaeb`, deeper `#fff0c2`) anchor form panels, feature cards, the footer, and featured pass tiers. Cream surfaces carry a `#e6d5a8` beige hairline.
- **Ink ramp** (`#1f1f1f` → `#a8a8a8`) for text; `#1c1c1e` for dark code/photographic cards.

**Type.** Editorial-serif ⨯ grotesque pairing — *the contrast is the voice.*
- **Instrument Serif** (display) for heroes (84px), section openers, page headlines, and stat callouts. Tight leading (1.05 on hero) and negative tracking (-1.5px → -0.5px, relaxing to 0 at small sizes).
- **Pretendard** (UI) for headings (weight 600), body (16px / generous 1.55 leading), captions, eyebrows, buttons. Korean + Latin.
- **JetBrains Mono** for code blocks, ticket IDs, QR strings.

**Spacing & layout.** 4px base, 8px primary increment. Marketing pages use a 96px section rhythm; content pages tighten to 64px. 1280px max container with 32px gutters; narrow forms ~720px. Heroes get 120px vertical padding so the sunset sky fills the frame.

**Backgrounds.** Atmospheric gradient skies (`--sunset-sky`) on heroes; flat cream or white elsewhere. **No** busy patterns, no noise/grain, no glassmorphism. Imagery (when present) is warm-toned, golden-hour — use `<image-slot>` placeholders or the gradient sky as a stand-in (we never generate photos).

**Shape & elevation.** Sober: **8px** buttons/inputs, **12px** cards (dominant), 16–20px for larger feature panels. Pills (`--radius-full`) **only** for badges and the rare pill tab — never buttons. Elevation is flat-first: default cards use a hairline border, not shadow. Reserve `--shadow-2` for product/feature cards, `--shadow-3` for dark mockups, `--shadow-4` for modals.

**Borders.** Hairlines do the structural work — `#ededed` soft dividers, `#c7c7c7` on inputs, `#e6d5a8` on cream surfaces. A 2px orange border marks input focus and featured pass tiers.

**Motion.** Restrained. `--dur-fast` 150ms / `--dur-base` 200ms on `cubic-bezier(0.4,0,0.2,1)`. Hover = subtle background/opacity shift; press = deepen to `primary-deep`. No bounces, no infinite decorative loops.

**Transparency & blur.** Effectively none — the system is opaque and warm. Depth comes from the sunset gradient and photography, not blur.

---

## Iconography

Wolf has no proprietary icon font in the supplied materials. **Lucide** (https://lucide.dev) is the substitute set — a clean ~1.75px-stroke open line family that sits well against Pretendard. Load it from CDN in mockups:

```html
<script src="https://unpkg.com/lucide@latest"></script>
<script>lucide.createIcons();</script>
<!-- usage: <i data-lucide="calendar"></i> -->
```

Conventions:
- **Stroke icons only** (no filled/duotone), sized 18–24px, colored `currentColor` (usually `--color-steel` or `--color-ink`; orange only when active).
- Common glyphs: `calendar`, `map-pin`, `ticket`, `search`, `sliders-horizontal`, `chevron-down`, `qr-code`, `shopping-bag`, `user`, `music`.
- **Emoji** is not an icon system here — a lone 🎟 in the promo banner is the only sanctioned use.
- The **brand mark** (`assets/wolf-mark.svg`) is a minimal sunset disc; the wordmark is `WOLF` set in the display face. If a real Wolf logo exists, replace the mark and flag it.

> Substitution flagged: Lucide stands in for an unknown real icon set. Confirm or replace.

---

## Index / manifest

**Root**
- `styles.css` — global entry point (consumers link this; `@import`s only).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadows.css`, `fonts.css`.
- `assets/` — `wolf-mark.svg` (brand mark).
- `readme.md` — this file. `SKILL.md` — Agent-Skills wrapper.

**Components** (`window.WolfDesignSystem_4d4911.*`)
- `components/core/` — **Button**, **Badge**
- `components/forms/` — **Input**, **Textarea**, **Select**
- `components/data/` — **Card**, **PassCard**, **StatCell**
- `components/navigation/` — **Tabs**, **PromoBanner**
- `components/signature/` — **SunsetStripe**, **HeroBand**, **CtaBanner**, **Footer**

Each directory has a `*.card.html` thumbnail, and each component a `.d.ts` + `.prompt.md`.

**Foundation cards** (`guidelines/`) — Colors (Brand, Cream, Ink, Lines), Type (Display, Headings, Body, Mono), Spacing (Scale, Radius & Elevation), Brand (Sunset Stripe, Wordmark).

**UI kit** (`ui_kits/website/`) — the Wolf festival website: homepage, browse/listing, festival detail + pass tiers, checkout, and my-passes wallet. Open `ui_kits/website/index.html` for the interactive click-through.

**Design System tab** renders every `*.card.html`. Starting Points: Button, Input, Card, Tabs, SunsetStripe, plus the website screens.
