---
name: wolf-design
description: Use this skill to generate well-branded interfaces and assets for Wolf, a festival-pass marketplace, either for production or throwaway prototypes/mocks. Contains design guidelines, colors, type, fonts, assets, and a UI kit for prototyping the warm "sunset" festival aesthetic.
user-invocable: true
---

Read the `readme.md` file within this skill first — it carries the brand context, content/voice fundamentals, visual foundations, and iconography. Then explore the other files:

- `styles.css` + `tokens/` — the single CSS entry point and all design tokens (colors, type, spacing, radius, shadows, fonts). Link `styles.css` to inherit everything.
- `components/` — reusable React primitives (Button, Badge, Input, Select, Textarea, Card, PassCard, StatCell, Tabs, PromoBanner) and the signature pieces (SunsetStripe, HeroBand, CtaBanner, Footer). Each has a `.prompt.md` with usage.
- `guidelines/` — foundation specimen cards (colors, type, spacing, brand).
- `ui_kits/website/` — interactive Wolf festival site recreation; the best reference for composing screens.
- `assets/` — brand mark.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and create static HTML files for the user to view. If working on production code, copy assets and apply the rules here to design as an expert in the Wolf brand.

Non-negotiables: keep the **sunset stripe** at every page bottom; reserve **orange** (`#fa520f`) for primary CTAs / active states / links; pair the **editorial serif display** (Instrument Serif, substitute for PP Editorial Old) with **Pretendard** UI text; **8px buttons / 12px cards**, pills only for badges; warm cream surfaces, no cool tones, restrained motion.

If the user invokes this skill without other guidance, ask what they want to build, ask a few clarifying questions, then act as an expert Wolf designer who outputs HTML artifacts or production code as needed.
