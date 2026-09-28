# Eyara Fashion — Index Page Layout Clone (Next.js)

A **layout-only, 1:1 structural clone** of <https://eyarafashion.com/>'s index page,
built with Next.js 15 (App Router) + Bootstrap 5 grid.

- ❌ **No images** — every image slot on the original page is replaced by a neutral
  placeholder block (diagonal-hatched `div`). There is not a single `<img>` in the project.
- ❌ No real content/JS features of the shop (no cart drawer, no sliders, no API calls).
- ✅ Structure, grid, spacing, typography, colours and responsive breakpoints match the live page.

## Run it

```bash
cd eyara-layout
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm start   # production build
```

## How the clone was verified

The live page was loaded in a headless Chromium and every major element's
`getBoundingClientRect()` + computed styles were captured at 1440px and 390px.
The clone was measured the same way and the numbers were made to match. For example at 1440px:

| Element | Live | Clone |
|---|---|---|
| Header total height | 239px | 239px |
| Logo box `x,y,h` | 72, 59, 92 | 72, 59, 92 |
| "All Categories" button | 72, 164, 306×47 | 72, 164, 306×47 |
| Search field / input width | 610 / 487 | 610 / 487 |
| SEARCH button | 889, 159, 123×48 | 889, 159, 123×48 |
| Hero banner | 60, 239, 1320×527 | 60, 239, 1320×527 |
| Section header row | 60, 806, 1320×45 | 60, 806, 1320×45 |
| First card / image | 300×425 / 282×282 | 300×425 / 282×282 |
| Status badge (IN-STOCK) | `x=88 y=946` | `x=88 y=946` |
| Cards on page | 48 (4 × 12) | 48 (4 × 12) |
| Document height | 8445px | 8444px |

At 390px the 2-column grid, card size (167×267), 157×157 image slot, badge at
`x=24 y=443`, fixed 70px bottom bar and the 1-column footer all match the live values.

## Section map (live page → this project)

| Live section | Files |
|---|---|
| Top bar (email · socials · language) | `components/Header.jsx`, `.header__top` in `app/globals.css` |
| Logo + main nav + Cart Total | `components/Header.jsx` |
| Slide-in mobile drawer (Category / Menu tabs) | `components/Header.jsx` + `.mobile-drawer` |
| "All Categories" dropdown + search + phone | `components/Header.jsx` |
| Hero banner (image slot) | `app/page.js` → `.hero_banner_placeholder` |
| 4 × product sections ("Ready Stock", "Women shoes collection", "Slipper", "Block Heels") | `components/ProductSection.jsx`, `components/ProductCard.jsx`, data in `lib/data.js` |
| Product card (image slot → colour swatches → title → prices → status badge) | `components/ProductCard.jsx` |
| Load More button | `app/page.js` |
| Fixed mobile bottom bar (Home · Shop · Category · WhatsApp · Cart) | `components/MobileBottomNav.jsx` |
| Footer (brand card + 3 link cards + copyright) | `components/Footer.jsx` |

## Key values taken from the live site

- **Palette** — the site's theme injects its primary colour at runtime:
  `--primary-color: #003315` (deep green), `--primary-hover: #002b12`,
  `--primary-light: #e0e7e3`. Purple (`#7d0ba7`) is still in the static CSS bundle
  but is overridden, so the rendered page is green.
- **Fonts** — Inter for body, Raleway for headings (both loaded with `next/font`).
- **Global `p { line-height: 26px }`** — this is why product titles are 26px tall
  even though the font-size is 14px.
- **Card rhythm** — `p-1 p-md-2` (8px) card padding, `px-1 x-md-2 px-2 px-md-3` inner
  padding, `my-2 my-md-5` (32px) vertical spacing per cell, `padding-top: 100%` square image box.
- **Status badge** — absolutely positioned against the *wrapper* (`top: 2rem`, 12px font,
  `#0f6b52` for IN-STOCK, primary colour for PRE-BOOK; `top: .2rem` + 10px under 576px).
- **Breakpoints** — logo/cart/search collapse at `xl` (1200px), 4→3→2 columns at
  `lg`/`md`, 12px typography + 2-column grid under 768px, footer curve `100% / 20% 20% 0 0`
  (8% under 768px), fixed bottom bar below 768px.
- **Background wash** — the three radial gradients of `.gradient-bg` are copied as-is.

## Files

```
eyara-layout/
├── app/
│   ├── globals.css      # every layout rule of the original + placeholder styling
│   ├── layout.js        # fonts (Inter, Raleway) + bootstrap import
│   └── page.js          # index page assembly
├── components/
│   ├── Header.jsx       # top bar, logo, nav, cart, categories, search, mobile drawer
│   ├── MobileBottomNav.jsx
│   ├── ProductSection.jsx
│   ├── ProductCard.jsx
│   ├── Footer.jsx
│   └── Icons.jsx        # inline SVG icons (replaces the site's icon fonts)
└── lib/data.js          # section titles, product names, prices, footer links
```

## Notes

- Product names/prices are the real ones read from the live page (text only, no images);
  a few extra names were written to fill each section to the live count of 12 cards.
- Links point to the same paths as the original (`/frontEnd/shop`, `/frontEnd/product-page/1153`, …)
  but only `/` exists in this project, so they will 404 by design.
- The dev server binds `0.0.0.0` so it can be previewed from outside the sandbox.
