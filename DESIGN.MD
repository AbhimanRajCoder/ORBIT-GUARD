# Design System Reference
> Combined style guide — Dala · Active Theory · GSAP · SpaceX

---

## Overview

All four systems share a **dark-canvas philosophy**: pure black (or near-black) as the sole page surface, white/off-white as the primary text, zero elevation/shadows, and a single deliberate accent color. The differences lie in how each system uses typography, particle/imagery atmosphere, and interactive component shape.

| System | Canvas | Primary Text | Accent | Shape Language | Atmosphere |
|---|---|---|---|---|---|
| **Dala** | `#000000` | `#ffffff` | `#8052ff` Plum Voltage | Pills (24px radius) | Particle constellation |
| **Active Theory** | `#000000` | `#ffffff` | `#343755` Midnight Violet | Capsule nav (500px) + minimal 5px buttons | WebGL 3D centerpiece |
| **GSAP** | `#0e100f` | `#fffce1` | `#0ae448` Pulse Green + rainbow | Pills (100px) + 8px cards | 3D gradient blobs |
| **SpaceX** | `#000000` | `#f0f0fa` | None (monochrome) | Square (4px radius) | Full-bleed photography |

---

## Color Tokens

### Dala — Violet Cosmos

```css
--color-void:           #000000;   /* Page canvas */
--color-bone:           #ffffff;   /* Primary text, icons, hairlines */
--color-ash:            #bdbdbd;   /* Secondary muted text */
--color-smoke:          #9a9a9a;   /* Tertiary, nav resting state */
--color-plum-voltage:   #8052ff;   /* Primary action, brand pulse — only chromatic fill */
--color-amber-spark:    #ffb829;   /* Outlined accents, lightweight emphasis */
--color-lichen:         #15846e;   /* Constellation node / decorative icon */
```

### Active Theory — Instrument Void

```css
--color-void-black:     #000000;   /* Page canvas + all modal surfaces */
--color-pure-white:     #ffffff;   /* Primary text, nav labels */
--color-graphite-border:#4d4d4d;   /* Hairline dividers */
--color-steel-border:   #808080;   /* Outlined button borders */
--color-fog-border:     #999999;   /* Tertiary button borders */
--color-ash-link:       #c6c6c6;   /* Muted links, secondary info */
--color-midnight-violet:#343755;   /* Cookie-accept only — never promote to CTA */
```

### GSAP — Neon Playground

```css
--color-void-black:     #0e100f;   /* Canvas — near-black, not pure */
--color-cream-glow:     #fffce1;   /* Primary text — warm off-white */
--color-olive-stone:    #42433d;   /* Muted borders, section dividers */
--color-ash-gray:       #7c7c6f;   /* Metadata, helper text */
--color-pulse-green:    #0ae448;   /* Brand chromatic voice */
--gradient-pulse-green: linear-gradient(114.41deg, #0ae448 20.74%, #abff84 65.5%);
--color-candy-pink:     #fec5fb;   /* Scroll tool accent */
--color-ember-orange:   #ff8709;   /* SVG tool accent */
--color-electric-violet:#9d95ff;   /* Creative tool accent */
--color-signal-blue:    #00bae2;   /* Technical/precise accent */
--color-lime-flash:     #abff84;   /* Gradient endpoint, green companion */
```

### SpaceX — Mission Control

```css
--color-void-black:     #000000;   /* Canvas — unbroken dark */
--color-star-white:     #f0f0fa;   /* All text, icons, borders — cool tint reads as instrument light */
--color-dim-steel:      #545457;   /* Secondary UI, dividers */
--color-dark-gunmetal:  #404040;   /* Low-emphasis nav separators */
/* No chromatic accent. Monochrome by design. */
```

---

## Typography

### Font Families

| System | Display / Nav | Body | Notes |
|---|---|---|---|
| **Dala** | Acronym (sub: Inter, Söhne, Space Grotesk) | Acronym | Single-family; weight + tracking do all the work |
| **Active Theory** | nbarchitekt (sub: Space Mono, IBM Plex Mono) | Times (sub: Georgia) | Technical mono labels vs. editorial serif body |
| **GSAP** | Mori (sub: Inter Tight, Manrope) | Mori | Single-family; color is the organizational device |
| **SpaceX** | D-DIN / D-DIN-Bold (sub: Barlow) | D-DIN | Industrial geometric — all-caps tracked labels everywhere |

### Type Scales

#### Dala — Acronym
| Role | Size | Line Height | Letter Spacing |
|---|---|---|---|
| caption | 12px | 1.5 | +0.05em |
| body-sm | 14px | 1.5 | +0.05em |
| subheading | 18px | 1.5 | +0.025em |
| heading-sm | 24px | 1.3 | +0.021em |
| heading | 36px | 1.2 | +0.021em |
| heading-lg | 48px | 1.1 | -0.04em |
| display | 78px | 0.9 | -0.04em |
| hero | 113px | 0.81 | -0.04em |

> **Rule:** Negative tracking only at 48px+. Positive tracking at body and below. Weight 200 for display headlines — the thinness is the signature.

#### Active Theory — nbarchitekt + Times
| Role | Size | Line Height | Face |
|---|---|---|---|
| caption / labels | 10–12px | 1.2 | nbarchitekt, uppercase |
| body | 14px | 1.5 | nbarchitekt |
| body-lg | 16px | 1.88 | Times |

> **Rule:** All UI labels in nbarchitekt uppercase. Times 16px exclusively for paragraph copy. Two-face maximum per surface.

#### GSAP — Mori
| Role | Size | Line Height | Letter Spacing |
|---|---|---|---|
| caption | 14px | 1.38 | -0.14px |
| body-sm | 16px | 1.4 | -0.16px |
| body | 18px | 1.38 | -0.18px |
| subheading | 21px | 1.2 | -0.23px |
| heading-sm | 24px | 1.15 | -0.26px |
| heading | 34px | 1.15 | -0.37px |
| heading-lg | 44px | 1.1 | -0.48px |
| display | 89px | 1.05 | -1.78px |
| display-lg | 101px | 1.0 | -2.02px |
| hero | 224px | 0.9 | -4.48px |

> **Rule:** Weight 400 for almost everything. Weight 600 only for inline emphasis words and active nav. Letter-spacing tightens proportionally — -0.010em at body, -0.020em at 89px+.

#### SpaceX — D-DIN
| Role | Size | Line Height | Letter Spacing |
|---|---|---|---|
| caption | 10px | 1.5 | 0.09em |
| body-sm | 12px | 1.5 | 0.10em |
| body | 13px | 1.7 | 0.10em |
| body-lg | 16px | 1.5 | 0.10em |
| headline | 48px | 1.0–1.25 | 0.02em (D-DIN-Bold) |

> **Rule:** 0.09–0.10em tracking on all non-headline text is non-negotiable — it's the brand's instrument-panel voice. Headlines drop to 0.02em at 48px to avoid decorative scatter.

---

## Spacing & Shapes

### Border Radius Philosophy

| System | Interactive Elements | Cards / Panels | Special |
|---|---|---|---|
| **Dala** | 24px pills | 24px | Nav, buttons, cards all 24px |
| **Active Theory** | 5px buttons | 12px panels | 500px pill nav (capsule) |
| **GSAP** | 100px pills | 8px cards | Tags 100px; no radius between 9–99px |
| **SpaceX** | 4px square | 4px | 32px pill reserved for toggles only |

> **Cross-system rule:** Every system has one signature radius it applies consistently. Never mix the signature radius with a contradictory one on the same element type.

### Spacing Scales

**Dala** (base 6px): 6 · 12 · 18 · 24 · 30 · 36 · 60 · 96 · 120px

**Active Theory** (compact): 4 · 6 · 12 · 13 · 14 · 16 · 18 · 28px

**GSAP** (base 4px): 8 · 12 · 16 · 20 · 24 · 32 · 76 · 96 · 108px

**SpaceX**: 4 · 10 · 12 · 13 · 15 · 18 · 20 · 24 · 30 · 40 · 60px

### Layout

| System | Max Width | Section Gap | Card Padding |
|---|---|---|---|
| Dala | 1200px | 60px | 24px |
| Active Theory | Full-bleed | — | 12–18px |
| GSAP | 1280px | 80px | 24px |
| SpaceX | Full-bleed | 60px | 20px |

---

## Components

### Button Taxonomy

#### Dala — Primary Action Button
- Pill shape, 24px radius
- Background: `#8052ff`, text: `#ffffff`
- Acronym weight 600, 12px, uppercase, tracking 0.05em
- Padding: 14px 16px
- **No border. No shadow. Only filled button in the system.**

#### Active Theory — Outlined Ghost Button
- Transparent fill, 1px border `#999999`, 5px radius
- nbarchitekt 13px uppercase white
- Padding: 4px vertical, 18px horizontal

#### Active Theory — Violet Filled Button (Cookie only)
- Background `#343755`, white text, 5px radius
- **Never promote to marketing CTA.**

#### GSAP — Pill Ghost Button (Primary CTA)
- 1px solid `#fffce1` border, transparent fill, 100px radius
- Cream Glow text 16–17px weight 400
- Includes trailing circular arrow icon
- **Accent colors on text only — never filled.**

#### SpaceX — Ghost Outline Button
- 1px solid `#f0f0fa`, transparent fill, 4px radius
- D-DIN 12–13px, 700 weight, uppercase, 0.10em tracking
- **No filled variant exists anywhere in the system.**

---

### Navigation Patterns

#### Dala
Fixed top bar. Logo left, text links right-of-center (Smoke → Bone on hover), pill CTA far right. Only the pill has color.

#### Active Theory — Connected Pill Nav
Two uppercase labels connected by a 1px white horizontal rule. 500px border-radius capsule, no fill. Floats top-right on the void.

#### GSAP
Minimal horizontal bar. Inline nav pill links in Cream Glow. "Get GSAP" ghost pill far right. Thin green promotional banner sits above.

#### SpaceX
Transparent full-width bar. Logo left, tracked uppercase D-DIN links right, launch selector widget far right. No sticky backdrop. No fill.

---

### Atmospheric / Hero Visuals

| System | Visual Element | Character |
|---|---|---|
| **Dala** | Particle constellation | Thousands of micro-shapes (triangles, circles, diamonds 2–6px) clustering into organic forms (brain, flower, sphere). Colors from brand palette. Density: thick center, sparse edge. Owns 50%+ of hero. |
| **Active Theory** | WebGL 3D centerpiece | Concentric translucent rings with hexagonal core, amber particle sparks, fluid ribbon trails. Centered, ~33% of viewport. The page IS the artifact. |
| **GSAP** | 3D gradient blobs | Abstract organic shapes with 114.41deg diagonal gradient (Pulse Green → Lime Flash). 8px radius, ~20% of viewport. Decorative punctuation, not informational. |
| **SpaceX** | Full-bleed photography | Cinematic spacecraft/planetary imagery. Raw-edged, full-viewport-width. Text floats over dark portions — no card, no tint. Photography IS the icon system. |

---

## Elevation & Surfaces

All four systems share one core rule: **zero elevation**.

- No shadows, no drop shadows, no glows, no blur effects
- No nested container or card panels
- Depth is created by: type weight contrast · color contrast · negative space · particle/photo field

**Surface differentiation:**
- Dala: hairline 1px border on void
- Active Theory: 1px `#4d4d4d` border — "cutouts in the same darkness"
- GSAP: 1px `#42433d` or `#fffce1` border on same `#0e100f` canvas
- SpaceX: positioning only — no border differentiates; photography provides all depth

---

## Imagery Principles

### Dala
Pure particle-based visual language. No photography. No illustration. Thousands of geometric primitives suggesting emergence and intelligence. Single outlined geometric icon (~100px, Lichen teal) as a focal anchor.

### Active Theory
Single WebGL artifact as the entire visual subject. No photography, no illustration, no iconography. Text labels are the only other visual element. Imagery-to-chrome ratio: extremely high.

### GSAP
Abstract sculptural 3D gradient shapes beside text in feature cards. No lifestyle photography. No product screenshots. No human imagery. The visual language is closer to generative art than SaaS design.

### SpaceX
High-production cinematic photography at planetary scale. Always raw-edged, full-viewport-width. Shot at warm-cool boundary of sunset or in absolute space black. Rockets and planets are the icon system. No illustrations, no product mockups.

---

## Shared Do's

- Use pure black (or near-black) as the sole canvas — no gray fills, no light backgrounds
- Suppress shadows and elevation everywhere — depth comes from contrast and particle/photo field
- Maintain a single chromatic accent per system — never introduce a second filled CTA color
- Use uppercase + tracked text for nav, labels, and buttons as an instrument-panel signal
- Let the atmospheric visual element (particles / 3D / photography) dominate real estate
- Use hairline 1px borders for structural separation instead of fills or shadows
- Apply border-radius consistently — each system has one signature radius and sticks to it

## Shared Don'ts

- Never use gradients, textures, or noise on surfaces — particles/photos provide all visual interest
- Never fill a button with a warm or arbitrary color — each system's filled button is a deliberate, singular exception
- Never use body type with overly tight tracking on dark backgrounds — legibility requires openness
- Never stack multiple atmospheric visual treatments (e.g., particles + glow + gradient surface)
- Never add decorative elements just to fill void space — the emptiness is intentional
- Never center-align large blocks of body copy in visual-first layouts

---

## Quick Reference — CSS Custom Properties (Composite)

```css
:root {
  /* ── Dala ── */
  --dala-void:          #000000;
  --dala-bone:          #ffffff;
  --dala-ash:           #bdbdbd;
  --dala-smoke:         #9a9a9a;
  --dala-plum-voltage:  #8052ff;
  --dala-amber-spark:   #ffb829;
  --dala-lichen:        #15846e;

  /* ── Active Theory ── */
  --at-void:            #000000;
  --at-white:           #ffffff;
  --at-graphite:        #4d4d4d;
  --at-steel:           #808080;
  --at-fog:             #999999;
  --at-ash-link:        #c6c6c6;
  --at-midnight-violet: #343755;

  /* ── GSAP ── */
  --gsap-void:          #0e100f;
  --gsap-cream:         #fffce1;
  --gsap-olive:         #42433d;
  --gsap-ash:           #7c7c6f;
  --gsap-green:         #0ae448;
  --gsap-pink:          #fec5fb;
  --gsap-orange:        #ff8709;
  --gsap-violet:        #9d95ff;
  --gsap-blue:          #00bae2;
  --gsap-lime:          #abff84;

  /* ── SpaceX ── */
  --sx-void:            #000000;
  --sx-star-white:      #f0f0fa;
  --sx-dim-steel:       #545457;
  --sx-gunmetal:        #404040;

  /* ── Shared structural tokens ── */
  --radius-sharp:       4px;    /* SpaceX */
  --radius-soft:        5px;    /* Active Theory buttons */
  --radius-panel:       12px;   /* Active Theory panels */
  --radius-card:        8px;    /* GSAP cards */
  --radius-pill-sm:     24px;   /* Dala */
  --radius-pill-lg:     100px;  /* GSAP */
  --radius-capsule:     500px;  /* Active Theory nav */
  --elevation:          none;   /* Universal */
  --shadow:             none;   /* Universal */
}
```

---

## Similar Brands (Cross-System)

**Linear** — Referenced by both Dala and GSAP: flat dark canvas, single violet/green accent, pill-shaped UI, sparse chrome.

**Midjourney** — Shares Dala's particle-field visual language and cosmic void aesthetic.

**Vercel** — Shares GSAP's ultra-tight display tracking, dark canvas, and geometric custom type.

**NASA / Blue Origin** — Share SpaceX's cinematic dark-canvas photography and minimal white technical typography.

**Resn / Tool / Unit9** — Share Active Theory's single WebGL artifact approach with uppercase instrument-panel labels.