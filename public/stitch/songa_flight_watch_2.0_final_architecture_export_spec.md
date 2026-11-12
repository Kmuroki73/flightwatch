# ==============================================================================
# SONGA FLIGHT WATCH 2.0 — MASTER ARCHITECTURE, DESIGN TOKENS & EXPORT SPECIFICATION
# Archive: SONGA_FLIGHT_WATCH_2_0_FINAL_DESIGN_EXPORT.zip
# Version: 2.0.0-PROD-RELEASE (Production Integration Baseline)
# ==============================================================================

## 1. EXECUTIVE SUMMARY & DESIGN OVERVIEW
Songa Flight Watch 2.0 is an intelligent aviation intelligence, predictive flight monitoring, agentic travel commerce, and contextual companion platform. 
The system operates on dual design systems:
- Dark Mode: `Songa Aerodynamics Intelligence` (#0D0E11 Canvas / #121316 Surface / #1B1B1F Elevated / #FF5E1E Songa Orange)
- Light Mode: `Aerospace Calm Luxury` (#FAF9F5 Warm Ivory / #FFFFFF Elevated / #FF5E1E Accent)

All pages are built with full responsiveness across Desktop (1440px+), Tablet, and Mobile Portrait (390px).

---

## 2. CANONICAL ROUTE & SCREEN INVENTORY (ALL 24 PRODUCTION SCREENS)

### A. Consumer Flight Intelligence & Travel Companion (Desktop Web)
1. `/` (Dark Mode Flagship) -> SCREEN_61 (`SONGA — Flight Intelligence Homepage`)
2. `/hero-minimal` (Cinematic Space Vector Hero) -> SCREEN_58 (`SONGA — Minimalist Flight Intelligence Hero`)
3. `/home-light` (Warm Ivory Calm Luxury Flagship) -> SCREEN_56 (`SONGA — The Intelligent Travel Companion (Light Mode)`)
4. `/search` (Airspace Telemetry & Radar Matrix) -> SCREEN_54 (`SONGA — Flight Intelligence & Search`)
5. `/flight/:id` (Flight Details Hub - Light Mode) -> SCREEN_52 (`SONGA — Flight Details Hub`)
6. `/flight/:id/dark` (Flight Details Hub - Dark & Weather Adaptive) -> SCREEN_40 (`SONGA — Flight Details Hub (Dark & Weather-Adaptive)`)
7. `/live-pulse` (Futuristic Dynamic Telemetry System) -> SCREEN_46 (`SONGA — Live Pulse Intelligent Travel Platform`)
8. `/watchlist` (Watchlist - Light Mode) -> SCREEN_50 (`SONGA — My Flights Watchlist`)
9. `/watchlist/dark` (Watchlist - Jetstream Core Dark Mode) -> SCREEN_38 (`SONGA — My Flights Watchlist (Dark Mode)`)
10. `/copilot` (AI Disruption Assistant) -> SCREEN_48 (`SONGA — AI Travel Assistant`)
11. `/calendar` (Smart Holiday Journey & Festive Mode) -> SCREEN_36 (`SONGA — Smart Travel Calendar & Holiday Journey Hub`)
12. `/checkout/paypal` (PayPal Express, Ledger & Sandbox) -> SCREEN_34 (`SONGA — PayPal Checkout, Billing & Developer Sandbox`)
13. `/commerce` (Agentic Travel Commerce & Haneda Services) -> SCREEN_32 (`SONGA — Agentic Travel Commerce & Marketplace`)
14. `/soundtrack` (Songa Soundtrack & In-Flight Ambient Hub) -> SCREEN_236 (`SONGA — Flight Soundtrack & In-Flight Ambient Audio Hub`)
15. `/whatsapp-companion` (WhatsApp Dispatch Companion Setup & QR) -> SCREEN_19 (`SONGA — Desktop WhatsApp Companion Setup & QR Verification`)

### B. Mobile Companion App Suite (Mobile Portrait 390px)
16. `/m/flight/:id` (Flight Details Mobile Light) -> SCREEN_44 (`SONGA — Flight Details (Mobile)`)
17. `/m/flight/:id/dark` (Flight Details Mobile Dark & Weather Adaptive) -> SCREEN_42 (`SONGA — Flight Details (Mobile Dark & Weather-Adaptive)`)
18. `/m/calendar` (Smart Calendar Mobile Dark) -> SCREEN_30 (`SONGA — Smart Travel Calendar (Mobile Dark)`)
19. `/m/checkout` (PayPal Mobile Checkout & Passkey Vault) -> SCREEN_28 (`SONGA — PayPal Checkout & Sandbox (Mobile Dark)`)
20. `/m/commerce` (Mobile Agentic Commerce & Gate-Side Pickup) -> SCREEN_26 (`SONGA — Agentic Travel Commerce & Services (Mobile Dark)`)
21. `/m/profile` (Traveler Profile, Privacy Vault & Ghost Purge) -> SCREEN_24 (`SONGA — Traveler Profile & Privacy Vault (Mobile Dark)`)
22. `/m/whatsapp` (WhatsApp Companion Bot & In-Flight Chat Simulator) -> SCREEN_21 (`SONGA — WhatsApp Companion & In-Flight Soundtrack (Mobile Dark)`)
23. `/m/soundtrack` (Mobile Flight Deck Soundtrack & Spatial Audio Deck) -> SCREEN_196 (`SONGA — Flight Deck Soundtrack (Mobile Dark)`)

### C. Enterprise Merchant Operations & Airside Apron Suite
24. `/ops/overview` (Merchant Overview & Dispatch Hub) -> SCREEN_17 (`SONGA — Merchant Operations Overview & Dispatch Hub`)
25. `/ops/orders` (Airside Order Lifecycle Ledger) -> SCREEN_15 (`SONGA — Airside Order Management & Lifecycle Ledger`)
26. `/ops/fulfilment` (Order Fulfilment & Runner Console) -> SCREEN_13 (`SONGA — Airside Order Fulfilment & Runner Dispatch Console`)
27. `/ops/inventory` (Airside Inventory & Service Station Control) -> SCREEN_11 (`SONGA — Merchant Airside Inventory & Service Station Control`)
28. `/ops/disputes` (Merchant Disputes & Support Hub) -> SCREEN_9 (`SONGA — Merchant Disputes & Customer Support Console`)
29. `/ops/team` (Merchant Profile, Airside Team & Settlement Hub) -> SCREEN_7 (`SONGA — Merchant Profile, Airside Team & Settlement Hub`)
30. `/m/runner/queue` (Apron Runner Queue & Concourse Navigation) -> SCREEN_3 (`SONGA — Apron Runner Dispatch Queue & Concourse Navigation`)
31. `/m/runner/handover` (Apron Runner Handover & Escrow Release) -> SCREEN_5 (`SONGA — Apron Runner Jetbridge Handover & Escrow Release`)

---

## 3. DESIGN TOKENS & SYSTEM SPECIFICATION

```css
:root {
  /* Obsidian Cockpit Dark Palette (Primary Aviation Intelligence) */
  --songa-bg-canvas: #0d0e11;
  --songa-bg-surface: #121316;
  --songa-bg-surface-elevated: #1b1b1f;
  --songa-bg-surface-high: #24252a;
  --songa-border-subtle: rgba(255, 255, 255, 0.08);
  --songa-border-active: rgba(255, 94, 30, 0.4);

  /* Light Theme Palette (Aerospace Calm Luxury) */
  --songa-light-canvas: #faf9f5;
  --songa-light-surface: #ffffff;
  --songa-light-surface-subtle: #f4f4f0;
  --songa-light-border: rgba(0, 0, 0, 0.08);

  /* Brand Accents & Status Indicators */
  --songa-orange: #ff5e1e;
  --songa-orange-glow: rgba(255, 94, 30, 0.18);
  --songa-emerald: #10b981;
  --songa-emerald-glow: rgba(16, 185, 129, 0.15);
  --songa-amber: #f59e0b;
  --songa-blue-radar: #0ea5e9;
  --songa-festive-gold: #d4af37;

  /* Typography Scale */
  --font-headings: 'Space Grotesk', -apple-system, sans-serif;
  --font-body: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
}
```

---

## 4. INTEGRATION & HANDOVER CONTRACTS (FOR ENGINEERING)

1. **Audio Streaming Architecture (Songa Soundtrack)**:
   - Pure metadata controller and remote API client.
   - Authentication via Spotify Web API & Apple Music Kit with OAuth 2.0 PKCE.
   - Decibel cap enforcement: Automatic volume normalization adheres to AC-120-76D in-cockpit hearing safety protocols.
   - Real-time flight event listener: Client subscribes to WebSocket `stream.songa.ai/v1/telemetry` to trigger TOD (Top of Descent) audio crossfades.

2. **WhatsApp Companion Bot Gateway**:
   - Webhook registration endpoint: `POST /v1/integrations/whatsapp/webhook`.
   - Cryptographic handshake: E.164 phone hash validated against temporary HMAC session tokens.
   - Zero-Knowledge Vault: Passenger direct contact vectors remain masked until apron runner is within <50m proximity lock.

3. **Merchant Airside Fulfilment & Escrow Verification**:
   - Two-phase commit: PayPal Capture creates a vaulted escrow token (`PP-VLT-***`); funds are disbursed to merchant balance ONLY upon physical NFC/passkey handshake at the jetbridge.
