# Michelle Tilton Site - Design Guide (v2)

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Ink | `#111111` | Primary text, dark backgrounds (CTA, logo bar) |
| Paper | `#faf7f2` | Page background |
| Cream | `#f0ece3` | Featured card backgrounds, secondary surfaces |
| White | `#ffffff` | Cards, service section backgrounds |
| Border | `#e2ddd6` | Default borders |
| Border Strong | `#c9c3b7` | Hover borders, stronger dividers |
| Muted | `#6b6356` | Secondary text, labels, captions |
| Sunset 1 | `#f4a261` | Gradient start, warm accent |
| Sunset 2 | `#e76f51` | Gradient end, primary accent (numbers, arrows, labels) |
| Teal | `#2a9d8f` | Avatar variant, photo placeholder |
| Navy | `#264653` | Avatar variant, photo placeholder |

### Sunset Gradient (for accent text)
```css
background: linear-gradient(90deg, #f4a261, #e76f51);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### Outlined Text (for headline drama)
```css
-webkit-text-stroke: 1.5px var(--ink);
-webkit-text-fill-color: transparent;
font-style: italic;
```

### Text Highlight (for bold words in body copy)
```css
background: linear-gradient(180deg, transparent 60%, rgba(244, 162, 97, 0.35) 60%);
padding: 0 2px;
```

---

## Typography

### Font Stack
- **Headings:** Bricolage Grotesque (400-800)
- **Body:** DM Sans (300-600)
- **Mono/Labels/Buttons:** JetBrains Mono (400-500)

### Google Fonts Import
```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Heading Scale
| Element | Size | Weight | Letter Spacing |
|---------|------|--------|----------------|
| h1 (hero) | clamp(48px, 8vw, 112px) | 800 | -0.04em |
| h2 (section) | clamp(32px, 4vw, 52px) | 800 | -0.03em |
| h3 (card) | 24-26px | 700 | -0.015em |

### Body Text
- Default: 17px, weight 400, line-height 1.65
- Lead/intro: 22px, weight 500, line-height 1.35 (use Bricolage Grotesque)
- Small: 14-15px

### Labels (monospace)
- Font: JetBrains Mono
- Size: 10-11px
- Weight: 500
- Letter spacing: 0.1-0.25em
- Transform: uppercase
- Color: `var(--muted)` or `var(--sunset-2)`
- Always preceded by a small horizontal line (via ::before pseudo-element)

---

## Components

### Section Label
```html
<div class="section-label">Label text</div>
```
Monospace, uppercase, muted color, preceded by a 24px line.

### Buttons

**Primary (dark pill):**
```html
<a href="#" class="btn-primary">Button text <span>&rarr;</span></a>
```
- Ink background, paper text, pill shape (border-radius: 100px)
- Hover: sunset-2 background

**Secondary (outline pill):**
```html
<a href="#" class="btn-secondary">Button text <span>&rarr;</span></a>
```
- Transparent, border-strong border
- Hover: ink border

**Light (for dark backgrounds):**
```html
<a href="#" class="btn-light">Button text <span>&rarr;</span></a>
```
- Paper background, ink text
- Hover: sunset-1 background

**Ghost (for dark backgrounds):**
```html
<a href="#" class="btn-ghost">Button text <span>&rarr;</span></a>
```
- Transparent, white 30% border
- Hover: white border

All buttons use JetBrains Mono, 11px, uppercase, 0.12em letter-spacing.

### Cards

**Service Card:**
- Background: paper
- Border: 1px solid var(--border)
- Border radius: 16px
- Padding: 36px 32px
- Hover: translateY(-4px), subtle box-shadow
- Contains: label (mono, sunset-2), title, description, arrow list, bottom CTA link

**Testimonial Card:**
- Background: white (or cream for featured)
- Same border/radius as service cards
- Contains: quote mark (72px, sunset-2), quote text (Bricolage Grotesque), attribution with avatar

**Result Card (dark):**
- Background: ink
- Contains: large gradient number, result text, client name (mono)

### Photo Placeholder
- Gradient: linear-gradient(135deg, var(--sunset-1), var(--sunset-2)) for primary
- Gradient: linear-gradient(135deg, var(--teal), var(--navy)) for secondary
- Border radius: 16px
- Caption overlay: rgba(17,17,17,0.85) with backdrop-filter blur

---

## Layout

### Container
- Max width: 1400px
- Padding: 0 48px (20px on mobile)

### Section Padding
- Standard: 100px top/bottom
- CTA: 120px top/bottom
- Hero: 80px top, 60px bottom

### Grid Patterns
- **Hero:** 1fr / 300px (headline / meta card)
- **Problem:** 380px / 1fr (header / list)
- **Services:** 2-column card grid, 16px gap
- **Proof:** 12-column grid (7+5 top row, 4+8 bottom row)
- **About:** 1fr / 1.2fr (photo / content)

### Borders
- Section dividers: 1px solid var(--border) on bottom
- Card borders: 1px solid var(--border), 16px radius
- List item dividers: 1px solid var(--border) on top

---

## Animations

### Scroll Reveal
```css
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```
Triggered by IntersectionObserver at 12% threshold.

### Hover Effects
- Cards: translateY(-4px), box-shadow: 0 12px 40px rgba(0,0,0,0.06)
- Buttons: background color change, 0.2s transition
- Links: color change to muted or sunset

---

## Dark Sections

The CTA and logo bar use dark (ink) backgrounds. On dark:
- Text: white
- Muted text: rgba(255,255,255,0.55-0.65)
- Borders: rgba(255,255,255,0.15-0.3)
- Accent: sunset-1 for labels/eyebrows
- Glow: radial-gradient with rgba(244,162,97,0.15)
- Outlined text: -webkit-text-stroke 1.5px white
- Gradient text: sunset-1 to sunset-2

---

## File Structure
```
index.html      - Home page
styles.css      - All styles
app.js          - Scroll reveal observer
about.html      - (to build)
services.html   - (to build)
work.html       - (to build)
contact.html    - (to build)
```

## Responsive Breakpoints
- **1000px:** Stack grids to single column, proof grid to 1 col
- **600px:** Hide non-CTA nav links, reduce padding to 20px
