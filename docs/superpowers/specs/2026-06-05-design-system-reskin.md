# Design System Reskin — Casa de Yim Dashboard

**Date:** 2026-06-05
**Scope:** Design tokens + component reskin (keep current flat header/main layout, no sidebar rail)
**Reference:** `/Users/temtem/Downloads/Casa de Yim Analytics.html`

---

## Goal

Apply the "Lagoon & Terracotta" design language from the reference file to the existing React app without changing the routing, data model, or layout structure (header + main). Every visual surface gets new fonts, colours, and component styles.

---

## Design Tokens

### Fonts (added to `index.html` via Google Fonts)

| Role | Family | Weight |
|------|--------|--------|
| Display headings (h1, h3, section titles) | Cormorant Garamond | 600, italic 600 |
| Numbers, UI labels, buttons | Manrope | 400, 600, 700, 800 |
| Metadata, chart axes | IBM Plex Mono | 400, 500 |
| Thai body text | Noto Sans Thai | 400, 500, 600, 700 |

### CSS Custom Properties (added to `:root` in `index.css`)

```css
--shell-1: #103A34;   /* dark header bg, active chip bg */
--shell-2: #0B2A26;
--primary: #1E6E62;   /* green deltas */
--accent:  #C56A45;   /* terracotta — buttons, AI block */
--accent-2:#A8542F;   /* darker terracotta — italic headings, down deltas, rule highlights */
--gold:    #E2A95B;   /* headline numbers, warn signal chips */
--sand:    #E7DFD2;   /* page background */
--panel:   #FBF8F2;   /* content panel bg */
--card:    #FFFFFF;
--card-2:  #F3EEE5;   /* alt section bg */
--ink:     #241D18;
--muted:   #8C8377;
--line:    rgba(36,29,24,.10);
```

---

## Component Changes

### 1. `index.html`
- Add Google Fonts `<link>` preconnect + stylesheet for Cormorant Garamond, Manrope, IBM Plex Mono, Noto Sans Thai.

### 2. `index.css`
- Add `:root` CSS custom properties above.
- Set `html { background: var(--sand); }` and `body { font-family: 'Noto Sans Thai','Manrope',system-ui,sans-serif; }`.
- Remove Tailwind `@tailwind base` defaults that override body bg (or add explicit override).

### 3. `tailwind.config.js`
Extend theme with design tokens so Tailwind classes reference CSS vars:

```js
theme: {
  extend: {
    colors: {
      shell: 'var(--shell-1)',
      primary: 'var(--primary)',
      accent: 'var(--accent)',
      'accent-2': 'var(--accent-2)',
      gold: 'var(--gold)',
      sand: 'var(--sand)',
      panel: 'var(--panel)',
      card: 'var(--card)',
      'card-2': 'var(--card-2)',
      ink: 'var(--ink)',
      muted: 'var(--muted)',
    },
    fontFamily: {
      display: ["'Cormorant Garamond'", 'serif'],
      sans: ["'Noto Sans Thai'", "'Manrope'", 'system-ui', 'sans-serif'],
      num: ["'Manrope'", 'sans-serif'],
      mono: ["'IBM Plex Mono'", 'monospace'],
    },
  },
}
```

### 4. `App.tsx` — Header reskin
Replace `bg-white border-b` header with dark green bar:

- `background: linear-gradient(150deg, var(--shell-1), var(--shell-2))`
- Rounded pill: brandmark `Y` in terracotta circle
- Wordmark: `Casa de Yim` in Cormorant Garamond 600, sub-label in spaced caps
- Tab nav: uppercase Manrope, active tab has terracotta underline
- Page background changes from `bg-slate-100` to `bg-sand` (`var(--sand)`)
- Content area wrapped in `var(--panel)` rounded card

### 5. `PeriodToggle.tsx` — Chip style
Replace `rounded-full bg-slate-800 / bg-white border` with:
- Default: white bg, `var(--line)` border, `var(--ink)` text
- Active: `var(--shell-1)` bg, white text
- Hover: `var(--card-2)` bg

### 6. `KpiCards.tsx` — Full redesign
Each card:
- White bg, `var(--line)` border, `border-radius: 22px`, subtle shadow
- **Label row:** `OCCUPANCY` in 10.5px Manrope uppercase + Thai pill (ห้องพักที่ขายได้ / ราคาเฉลี่ย/คืน / รายได้/ห้องว่าง) in `var(--card-2)` bubble
- **Number:** 50px Manrope 800, `var(--ink)`. Baht symbol in 26px muted. `%` suffix in 22px muted.
- **Deltas row:** dashed top border; `MoM` / `YoY` labels in Manrope uppercase muted; values: up = `var(--primary)`, down = `var(--accent-2)`, flat = `var(--muted)`
- **Glyph watermark:** `Occ` / `ADR` / `RevPAR` in 100px Cormorant Garamond italic, `rgba(36,29,24,.05)`, absolute bottom-right

### 7. Section wrapper component (new: `SectionCard.tsx`)
Thin shared wrapper used by TrendChart, ForecastSection, ForwardPace, MixPanels:
- Props: `alt?: boolean` (uses `var(--card-2)` bg), `children`
- White bg (or card-2 if alt), `border-radius: 22px`, `var(--line)` border, subtle shadow
- Section heading via `<SectionHead title="…" italic="…" meta="…" />` sub-component: Cormorant Garamond h3, italic part in `var(--accent-2)`, meta in IBM Plex Mono muted

### 8. `TrendChart.tsx` — Color update
Keep Recharts. Update only:
- Actual bars: `var(--shell-1)` (`#103A34`)
- On-the-books bars: `#B6C2C6`
- ADR line: `var(--accent)` (`#C56A45`)
- Axis font: IBM Plex Mono 10px, `var(--muted)`
- Wrap in `<SectionCard>`

### 9. `ForecastSection.tsx` — Color + stat strip
- Wrap in `<SectionCard alt>` (card-2 bg)
- Forecast stat strip (Occ%, ADR, Revenue): white inner cards, 30px Manrope 800 numbers, muted baht symbol
- Actual bars: `var(--shell-1)`, current month: `var(--accent)`, on-the-books: `#B6C2C6`

### 10. `ForwardPace.tsx` — Color update
- Wrap in `<SectionCard>`
- Booked bars: `#5481A6`, empty: `#E3E7E9`

### 11. `MixPanels.tsx` — Channel + Country reskin
- Wrap each panel in `<SectionCard>`
- Channel rows: coloured dot avatar (shell-1 / accent), gradient progress bars, ADR in muted
- Country rows: keep existing layout, bar colour → `var(--shell-1)` gradient

### 12. `Recommendations.tsx` — Two-column gradient card
Replace plain white card with split layout:

**Left panel** (forest green gradient `#2E8576 → #11463E`):
- Eyebrow: Noto/Manrope, uppercase, 60% white
- Headline: Noto/Manrope 800 19px; key numbers wrapped in `<span style="color:var(--gold)">` (e.g. `33.9%`)
- Signal chips: Noto/Manrope 600; warn chips in `rgba(226,169,91,.22)` / gold text; others in `rgba(255,255,255,.14)` / white. Each chip shows a bold value (`font-weight:800`) inside the label text.
- CTAs: terracotta "✨ ถาม AI" primary button + ghost "ดูทั้งหมด"

**Right panel** (accent-soft `#F6DCCB`):
- Eyebrow in muted terracotta
- Rule items: `rgba(255,255,255,.65)` rounded rows, coloured dot (red/green), key figures bolded in `var(--accent-2)` (`#A8542F`)
- AI chat input at bottom: white pill, dark green "ถาม AI" button

**No serif fonts in this block** — Noto Sans Thai + Manrope only throughout.

---

## Favicon Regeneration

The existing favicons in `public/` were generated from a generic source. Replace with a branded set matching the design system:

- **Visual:** `Y` lettermark in Cormorant Garamond, white on terracotta circle (`#C56A45`), matching the brandmark in the header
- **Sizes:** 16×16, 32×32, 180×180 (apple-touch-icon), 192×192, 512×512 (android-chrome)
- **Method:** Generate programmatically using a Node script that draws to Canvas and saves PNG files, then convert to `.ico`. No external tools required.
- **Output files:** Replace all files currently in `public/` (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`)
- Update `site.webmanifest` name to `"Casa de Yim"`

---

## What Does NOT Change

- Routing and tab logic (`App.tsx` state)
- All data-fetching, snapshot logic, parser, metrics
- `AuthGate.tsx`, `LoginPage.tsx`, `UploadPage.tsx` (out of scope)
- Chart library (stays Recharts)
- No new pages or routes

---

## File Checklist

```
Modified:
  index.html                          ← add Google Fonts links
  index.css                           ← CSS vars, body/html base styles
  tailwind.config.js                  ← extend theme with tokens
  src/ui/App.tsx                      ← dark header, sand bg, panel wrapper
  src/ui/Dashboard.tsx                ← remove max-w-5xl, let panel handle
  src/ui/components/PeriodToggle.tsx  ← chip styles
  src/ui/components/KpiCards.tsx      ← full card redesign
  src/ui/components/TrendChart.tsx    ← colours + SectionCard wrapper
  src/ui/components/ForecastSection.tsx ← alt card, stat strip, colours
  src/ui/components/ForwardPace.tsx   ← colours + SectionCard wrapper
  src/ui/components/MixPanels.tsx     ← channel/country reskin
  src/ui/components/Recommendations.tsx ← two-column gradient card

New:
  src/ui/components/SectionCard.tsx   ← shared section wrapper + SectionHead
```
