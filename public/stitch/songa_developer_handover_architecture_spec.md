# SONGA FLIGHT WATCH — DEVELOPER HANDOVER & ARCHITECTURE SPECIFICATION
**Version:** 4.8.2-PROD-RELEASE  
**Design System:** `Songa Aerodynamics Intelligence` (Dark #121316 / Obsidian #0D0E11) & `Aerospace Calm Luxury` (Light #FAF9F5)  
**Primary Accent:** `#FF5E1E` (Songa Orange) | **Status Emerald:** `#10B981` | **Warning Amber:** `#F59E0B` | **Festive Gold:** `#D4AF37`  
**Target Viewports:** Desktop (1440px+ standard), Mobile Portrait (390px responsive)

---

## 1. PROJECT OVERVIEW & ARCHITECTURAL INVENTORY

Songa Flight Watch is an intelligent global aviation and travel companion platform integrating real-time ADS-B satellite telemetry, predictive route disruption analysis, contextual agentic commerce, smart calendar scheduling, and encrypted traveler personalization.

### Complete Screen & Route Inventory

| Screen ID | Canonical Route / Page Name | Form Factor | Theme | Primary Module / Core Journey |
| :--- | :--- | :--- | :--- | :--- |
| `SCREEN_40` | `/` | Desktop | Dark | Flagship Flight Intelligence Homepage (HUD + Global Airspace) |
| `SCREEN_37` | `/hero-minimal` | Desktop | Dark | Minimalist Cinematic Space Vector Hero |
| `SCREEN_35` | `/home-light` | Desktop | Light | The Intelligent Travel Companion (Light Mode Flagship) |
| `SCREEN_33` | `/search` | Desktop | Dark | Airspace Flight Intelligence Search & Radar Matrix |
| `SCREEN_31` | `/flight/:id` | Desktop | Light | Flight Details Hub (Standard Light) |
| `SCREEN_29` | `/watchlist` | Desktop | Light | My Flights Watchlist (Light Mode) |
| `SCREEN_27` | `/copilot` | Desktop | Dark | Songa AI Travel Assistant & Disruption Copilot |
| `SCREEN_25` | `/live-pulse` | Desktop | Dark | Live Pulse Dynamic Interaction & Telemetry System |
| `SCREEN_19` | `/flight/:id/dark` | Desktop | Dark | Flight Details Hub (Weather-Adaptive & Radar Layer) |
| `SCREEN_17` | `/watchlist/dark` | Desktop | Dark | My Flights Watchlist (Aviation Dark Mode + Jetstream Core) |
| `SCREEN_15` | `/calendar` | Desktop | Dark | Smart Travel Calendar & Holiday Journey Hub (Festive Mode) |
| `SCREEN_13` | `/checkout/paypal`| Desktop | Dark | PayPal Express Checkout, Billing Ledger & Dev Sandbox |
| `SCREEN_11` | `/commerce` | Desktop | Dark | Agentic Travel Commerce, Haneda Smart Services & Delay Defense |
| `SCREEN_42` | `/memory-soundtrack` | Desktop | Dark | Songa Memory Vault, Contextual Coffee & Songa Soundtrack |
| `SCREEN_43` | `/whatsapp-companion`| Desktop | Dark | Encrypted WhatsApp Companion, Bot Simulator & Telemetry |
| `SCREEN_23` | `/m/flight/:id` | Mobile | Light | Flight Details Hub (Mobile Responsive) |
| `SCREEN_21` | `/m/flight/:id/dark`| Mobile | Dark | Flight Details Hub (Mobile Dark Weather-Adaptive) |
| `SCREEN_9` | `/m/calendar` | Mobile | Dark | Smart Travel Calendar (Mobile Dark + Festive Toggle) |
| `SCREEN_7` | `/m/checkout` | Mobile | Dark | PayPal Checkout & Developer Sandbox (Mobile Dark) |
| `SCREEN_5` | `/m/commerce` | Mobile | Dark | Agentic Travel Commerce & Terminal Services (Mobile Dark) |
| `SCREEN_3` | `/m/profile` | Mobile | Dark | Personal Traveler Profile, Privacy Vault & Ghost Purge |

---

## 2. REUSABLE ATOMIC DESIGN TOKENS & COMPONENTS

### Color Tokens
```css
:root {
  /* Obsidian Cockpit Dark Palette */
  --songa-bg-canvas: #0d0e11;
  --songa-bg-surface: #121316;
  --songa-bg-surface-elevated: #1b1b1f;
  --songa-bg-surface-high: #24252a;
  --songa-border-subtle: rgba(255, 255, 255, 0.08);
  --songa-border-active: rgba(255, 94, 30, 0.4);

  /* Brand Accents */
  --songa-orange: #ff5e1e;
  --songa-orange-glow: rgba(255, 94, 30, 0.15);
  --songa-emerald: #10b981;
  --songa-emerald-glow: rgba(16, 185, 129, 0.15);
  --songa-amber: #f59e0b;
  --songa-festive-gold: #d4af37;
  --songa-festive-glow: rgba(212, 175, 55, 0.12);

  /* Typography */
  --font-mono: 'Space Grotesk', 'JetBrains Mono', monospace;
  --font-sans: 'Space Grotesk', -apple-system, sans-serif;
}
```

### Shared Global Components
1. **Persistent Global Top Header (`web_standard`)**:
   - Left: Songa brand wordmark + AVN-OPS indicator badge (`4,812 FLIGHTS MONITORED`).
   - Center: Modular navigation links (`FLIGHTS`, `DETAILS`, `WATCHLIST`, `CALENDAR`, `TRAVEL COMMERCE`, `AI ASSISTANT`, `BILLING & PASSES`, `MEMORY & AUDIO`, `WHATSAPP`).
   - Right: Live UTC real-time clock (`HH:MM:SS UTC`), Optional Festive Mode Toggle (`FESTIVE MODE ON/OFF`), Track Flight primary CTA, User Profile trigger.
2. **Persistent Mobile Tab Navigation Bar (`mobile_tab`)**:
   - 5 ergonomic touch targets: **Flights** (`/m/flight`), **Calendar** (`/m/calendar`), **Passes** (`/m/checkout`), **Copilot** (`/m/commerce`), **Profile** (`/m/profile`).
3. **Avionics Telemetry Ribbon**:
   - Status indicators: `ATMOSPHERE: NOMINAL / FL410 CLEAR`, `SAT-FEED: GEO-SYNC ACTIVE`, `STREAM RATE: 1.24 GB/S`, `ADS-B MESH REFRESH: 4 SEC`.
4. **Songa Footer Compliance Matrix**:
   - ICAO DOC 4444 and IATA AHM 560 dispatch audit certificates, API dispatch gateway status, and TLS 1.3 encryption verification.

---

## 3. CORE USER JOURNEYS & FUNCTIONAL MAPPING

### A. Songa Memory & Personal Travel Vault
- **Principle**: Zero speculative memory. Only stores verified user-approved orders and explicit preferences.
- **Privacy Controls**: Granular toggles to enable/disable specific memory categories (Refreshments, Lounges, Aircraft Seating, Chauffeurs). Instant "Wipe Travel Memory" local cache purge.

### B. Contextual In-Flight Refreshments
- **Triggers**: Touchdown, gate-hold, or airside lounge proximity.
- **Rules**: Never auto-order. Displays fixed vendor pricing, exact terminal/gate pickup location, custom dietary flags (e.g. Oat Milk, Double Shot), and single-tap checkout via pre-authorized PayPal or Apple Pay passkey.
- **Timing Engine**: 45-minute post-order check-in prompt only appears if user opted in AND vendor remains operational.

### C. Songa Soundtrack ("Your Journey. Your Soundtrack.")
- **Integration**: Lightweight API bridge connecting to Spotify, Apple Music, and YouTube Music via OAuth 2.0 PKCE.
- **Design Constraint**: Pure metadata viewer & remote playback controller. Never hosts, streams, or distributes raw audio.
- **Curated Journeys**: High-altitude ambient, Tokyo midnight arrivals, Trans-Polar focus, and Transatlantic sleepscapes.

### D. Encrypted WhatsApp Dispatch Companion
- **End-to-End Flow**: Mobile number input -> E.164 normalization -> 6-digit cryptographic verification -> Webhook registration (`Supabase Edge Function`).
- **Interactive Simulator**: Live command parser supporting `WATCH SGA-882`, `STATUS`, `GATE`, `DELAY`, and `CLAIM EU261`. Escalate to human concierge upon 2 consecutive ambiguous intents.

### E. PayPal Express Checkout & Developer Sandbox
- **Production Integration**: PayPal v2 Orders API (`POST /v2/checkout/orders`, `POST /v2/checkout/orders/{id}/capture`).
- **Developer Testbed**: Integrated state harness with mock status simulators (200 Capture, 422 Declined, Async Webhooks, Idempotency Key validation, Instant Refund).

---

## 4. INTEGRATION & TESTING CHECKLIST FOR BACKEND TEAMS

1. **Supabase Schema**:
   - Table `traveler_memories`: `(id uuid, user_id uuid, category text, payload jsonb, consent_given boolean, updated_at timestamp)`.
   - Table `whatsapp_subscribers`: `(phone_e164 text, verification_token text, verified boolean, active_flight_watch text[])`.
2. **ADS-B Telemetry Stream**: Connect client WebSocket directly to `wss://stream.songa.ai/v1/telemetry`.
3. **No Breaking Changes**: All original CSS class namespaces, SVG icon paths, and routing tokens from Iterations 0–14 remain 100% backward compatible.
