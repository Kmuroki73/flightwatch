---
name: Aerospace Calm Luxury
colors:
  surface: '#faf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#faf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f0'
  surface-container: '#efeeea'
  surface-container-high: '#e9e8e4'
  surface-container-highest: '#e3e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#5b4138'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f2f1ed'
  outline: '#8f7066'
  outline-variant: '#e3beb3'
  surface-tint: '#ab3500'
  primary: '#ab3500'
  on-primary: '#ffffff'
  primary-container: '#ff5e1e'
  on-primary-container: '#561600'
  inverse-primary: '#ffb59d'
  secondary: '#5e5e62'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e6'
  on-secondary-container: '#646468'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#00a874'
  on-tertiary-container: '#003421'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59d'
  on-primary-fixed: '#390c00'
  on-primary-fixed-variant: '#832700'
  secondary-fixed: '#e3e2e6'
  secondary-fixed-dim: '#c7c6ca'
  on-secondary-fixed: '#1b1b1f'
  on-secondary-fixed-variant: '#46464a'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e3e2df'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 56px
    fontWeight: '600'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Manrope
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  telemetry-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies the serenity, precision, and technological command of high-altitude travel. Merging the restraint of high-end Swiss editorial layouts with modern aerospace avionics, it prioritizes clarity, spaciousness, and unhurried confidence.

### Design Principles
- **Aeronautical Poise:** Every element functions with purposeful intent. Avoid visual clutter; surfaces stay clean and spacious, allowing critical navigational and flight telemetry to lead.
- **Calm Luxury:** Soft, warm-spectrum ivory planes juxtaposed with razor-thin hairline dividers replace heavy drop shadows and loud color fills.
- **Micro-Precision Feedback:** Subtle transitions, optical metric alignment, and glass overlays communicate technical mastery and reassuring authority without overwhelming the traveler.

## Colors

The palette leverages an ultra-refined warm ivory canvas to eliminate stark glare, complemented by deep charcoal ink tones for authoritative contrast. The signature radiant orange serves as an intentional locator beacon and primary interaction trigger.

### Palette Architecture
- **Primary Canvas (`#FAF9F5`):** Soft ivory background that provides warm, glare-free optical comfort across long flights and bright terminal conditions.
- **Secondary Canvas (`#F2F1EC`):** Muted stone-neutral used for grouped bays, secondary navigation rails, and segmented controls.
- **Surfaces (`#FFFFFF`):** Crisp pure white reserved for cards, floating HUD pods, and flight pass containers.
- **Brand Accent (`#FF5E1E`):** Concentrated, luminous orange reserved strictly for high-priority CTAs, current leg routes, active gate changes, and critical focus states.
- **Text & Hierarchy:** Deep charcoal (`#141518`) ensures effortless scannability; secondary slate (`#5C6068`) drives structural telemetry labels and metadata.
- **Flight Diagnostics & Status:**
  - *Nominal / On-Time:* Crisp Emerald (`#10B981`)
  - *Advisory / Weather Caution:* Warm Amber (`#F59E0B`)
  - *Critical / Disruption:* Controlled Coral-Red (`#EF4444`)

## Typography

The typographic hierarchy marries the geometric elegance of **Manrope** for sweeping destinations and luxury statements with the tabular, utilitarian clarity of **Inter** for real-time telemetry, boarding gate identifiers, and flight durations.

### Typographic Principles
- **Airport IATA & Telemetry Readouts:** Display coordinates, gate indicators, and IATA codes (e.g., `ZRH`, `HND`, `JFK`) with uppercase tabular numbers (`font-variant-numeric: tabular-nums`) and slight tracking (`+0.04em` to `+0.06em`) for instantaneous recognition.
- **Editorial Sub-headers:** Use `Manrope` with light weights and balanced line height to provide an elevated concierge tone.
- **Micro Labels:** Flight statistics, altitude meters, and time-to-descent captions rely on `label-sm` with deliberate capitalization and letter spacing to retain structural clarity at small viewports.

## Layout & Spacing

The layout philosophy follows a disciplined, responsive 12-column fluid grid on desktop and tablet, collapsing into a structured single-column stack on mobile. Spatial pacing favors generous breathing room around central data structures to mimic the uncluttered horizon of open flight.

### Structure & Rhythm
- **Desktop (1024px+):** 12-column grid with `3rem` canvas margins and `1.5rem` gutters. Content containers cap at `1280px` max-width to preserve optimal line lengths.
- **Tablet (768px - 1023px):** 8-column layout with `2rem` margins and `1.25rem` gutters.
- **Mobile (Below 768px):** 4-column fluid system with `1.25rem` outer margins. Flight route progress indicators and gate badges lock to full-width horizontal tracking cards.
- **Vertical Cadence:** Strict 8pt spatial grid for element separation. Complex telemetry blocks leverage `space-xs` and `space-sm` for dense data relationships, enclosed by `space-lg` to `space-xl` container padding.

## Elevation & Depth

Visual hierarchy is communicated via razor-thin boundaries, tone changes, and diffuse ambient dispersion rather than heavy shadows. The interface feels weightless, precise, and atmospheric.

### Depth Stratification
- **Level 0 (Base Canvas):** Solid warm ivory (`#FAF9F5`), zero elevation.
- **Level 1 (Structural Cards & Bays):** Solid white (`#FFFFFF`) surfaces bound by a crisp hairline border (`1px solid #E6E4DD`). Elevation is reinforced through an ultra-soft atmospheric shadow: `0px 4px 24px -2px rgba(20, 21, 24, 0.03), 0px 1px 3px 0px rgba(20, 21, 24, 0.02)`.
- **Level 2 (Interactive Floating Pods & Flight Passes):** Lifted slightly above cards during hover or active flight tracking. Elevated shadow: `0px 12px 32px -4px rgba(20, 21, 24, 0.05), 0px 2px 6px -1px rgba(20, 21, 24, 0.03)`.
- **Level 3 (Avionic HUD Overlays & Modal Drawers):** Translucent frosted glass effect using `rgba(255, 255, 255, 0.82)` with `backdrop-filter: blur(16px) saturate(180%)` and a 1px border of `rgba(230, 228, 221, 0.6)`. Retains connection with underlying route maps while focusing the traveler's attention.

## Shapes

The design system employs a refined curvature profile (`roundedness: 2` / baseline `8px` to `12px`) balancing industrial instrument precision with organic human warmth.

### Shape Application Guidelines
- **Core Cards & HUD Modules:** Use `10px` to `12px` corner radii (`rounded-lg`), ensuring crisp alignment with interior data grids.
- **Interactive Controls (Inputs, Action Bars):** Use `8px` radii (`rounded-md`) to communicate structural affordance.
- **Status Indicators & Aviation Badges:** Full pill shaping (`rounded-full` / `9999px`) for contextual statuses (e.g., "ON SCHEDULE", "GATE B22", "TURBULENCE AHEAD") to distinguish dynamic operational conditions from persistent structural modules.

## Components

### Buttons
- **Primary Brand Button:** Solid signature orange (`#FF5E1E`) fill with pure white typography (`#FFFFFF`, `label-md`). Padding: `12px 24px`. Micro-hover: subtle brightness lift to `#F95716` accompanied by an imperceptible `translateY(-1px)` shift.
- **Secondary Console Button:** Pure white background (`#FFFFFF`) framed by hairline border (`1px solid #E6E4DD`), deep charcoal text (`#141518`). Hover: subtle shift to neutral gray (`#F2F1EC`).
- **Ghost Utility Button:** Zero border, slate text (`#5C6068`), shifts to deep charcoal on hover with a muted background tint (`rgba(20, 21, 24, 0.04)`).

### Flight Cards & HUD Bays
- Enclosed in pure white (`#FFFFFF`) with a 1px perimeter border (`#E6E4DD`).
- **Header:** Features departure/arrival IATA abbreviations in large `headline-lg` Manrope typography, linked by an elegant, razor-thin vector path with an aircraft waypoint node.
- **Telemetry Row:** Displays flight number, aircraft type (e.g., "A350-900"), seat allocation, and baggage carousel number in muted tabular `label-sm` labels over dark charcoal values.

### Status Pills & Badges
- Pill-shaped (`rounded-full`) with a height of `24px` to `28px`, containing a `6px` circular status beacon on the left.
- **Nominal:** Soft mint background (`#ECFDF5`), emerald text (`#047857`), solid emerald beacon (`#10B981`).
- **Advisory:** Pale amber background (`#FFFBEB`), deep amber text (`#B45309`), solid amber beacon (`#F59E0B`).
- **Disrupted:** Gentle coral background (`#FEF2F2`), crimson text (`#B91C1C`), pulsing coral beacon (`#EF4444`).

### Input Fields & Search Bars
- Background: `#FFFFFF` with default `1px solid #E6E4DD` border.
- Height: `44px`, internal padding: `0 16px`. Text rendered in `body-md`.
- Focus state: Hairline border transitions smoothly to deep charcoal (`#141518`) with an outer focus glow ring of `0 0 0 3px rgba(255, 94, 30, 0.12)`.
- Floating labels: `label-sm` transitioning smoothly above input baseline on focus or input presence.

### Checkboxes & Toggle Switches
- **Checkboxes:** `18px x 18px` squares with a `4px` radius. Inactive: hairline border (`#D1CFC7`). Selected: filled with deep charcoal (`#141518`) carrying a crisp white check vector.
- **Switches:** Pill container (`40px x 22px`) in soft neutral gray (`#E6E4DD`). When active, transitions to signature orange (`#FF5E1E`) with a smooth gliding pure white circular thumb (`18px`).

### Telemetry Lists & Data Strips
- Borderless rows separated by `1px solid #F2F1EC` dividers.
- Left-aligned metadata identifier rendered in `label-sm` (`#5C6068`, uppercase).
- Right-aligned metric readout rendered in `body-md` / `Manrope` (`#141518`, tabular figures).