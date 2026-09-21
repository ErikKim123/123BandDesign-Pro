# Wolf Festival Website — UI kit

High-fidelity, click-through recreation of the Wolf festival-pass site. Open `index.html` for the interactive flow.

**Flow:** Home → Browse (filter by genre) → Festival detail (lineup / info / map tabs + pass tiers) → Checkout (cream payment panel) → My Passes wallet (ticket card + QR).

**Files**
- `index.html` — entry; loads React, the DS bundle, Lucide icons, then the screens.
- `data.js` — sample festivals, pass tiers, `wolfWon()` formatter.
- `Nav.jsx` — promo banner + sticky top nav.
- `FestivalCard.jsx` — listing card (gradient sky + meta + from-price).
- `HomeScreen.jsx` · `BrowseScreen.jsx` · `DetailScreen.jsx` · `CheckoutScreen.jsx` · `WalletScreen.jsx`
- `App.jsx` — route state + screen wiring.

**Composes** the DS components: `HeroBand`, `CtaBanner`, `Footer`, `SunsetStripe`, `Button`, `Badge`, `Card`, `PassCard`, `StatCell`, `Tabs`, `PromoBanner`, `Input`, `Select`. Icons via Lucide CDN (`data-lucide`). Imagery is warm CSS gradient stand-ins — swap in `<image-slot>` or real golden-hour photography for production.
