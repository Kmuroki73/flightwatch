# Songa AI 2.0 — dual deployment and judge readiness

## Build the two Vercel bundles

1. Copy `.env.sandbox.example` to `.env.sandbox` and enter the SANDBOX Supabase URL and anon/publishable key.
2. Copy `.env.live.example` to `.env.live` and enter the LIVE Supabase URL and anon/publishable key.
3. In PowerShell, run only: `Set-ExecutionPolicy -Scope Process Bypass; .\BUILD-RELEASES.ps1`
4. The script runs dependency install, static milestone checks, typecheck, lint, and both Vite production builds. It creates `Songa-AI-2.0-Sandbox-Dist.zip` and `Songa-AI-2.0-Live-Dist.zip`.

The two browser bundles differ only in their public Supabase configuration. PayPal mode and provider secrets are held by Supabase Edge Functions, not Vercel's browser bundle.

## Critical isolation requirement

To operate two URLs concurrently with different PayPal modes, use two Supabase projects:

- Sandbox Vercel deployment → Sandbox Supabase project → PayPal Sandbox credentials and webhook IDs.
- Live Vercel deployment → Live Supabase project → PayPal Live credentials and webhook IDs.

Do not deploy Sandbox and Live PayPal secrets to the same Supabase project at the same time. The Edge Function runtime reads one `PAYPAL_ENVIRONMENT` and one set of credentials per project. A single shared project cannot safely serve both payment modes concurrently.

The current known project `qrvzpfdlyzmnzblaildz` is the existing Songa project. Do not overwrite its current secrets or apply migrations blindly. Decide whether it remains production or is copied to a dedicated sandbox project before configuring the second URL.

## Environment classification

### Vercel build variables — browser-visible

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Optional `VITE_FLIGHT_SEARCH_FUNCTION_URL`
- Optional `VITE_WHATSAPP_LINK_FUNCTION_URL`

Never add `SUPABASE_SERVICE_ROLE_KEY`, AeroAPI, AI provider, Twilio or PayPal secrets as `VITE_*` variables.

### Supabase Edge Function secrets — server-only

- `AEROAPI_API_KEY` (functions also accept legacy `AEROAPI_KEY`)
- `GROQ_API_KEY`, optional `GROQ_MODEL`
- `GEMINI_API_KEY`, optional `GEMINI_MODEL`
- `PAYPAL_ENVIRONMENT`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID` (legacy flight assistance webhook)
- `PAYPAL_COMMERCE_WEBHOOK_ID` (shared commerce webhook)
- `SONGA_APP_URL`, `SONGA_RATE_LIMIT_SALT`, optional `SONGA_PREMIUM_PRICE_USD`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_WHATSAPP_FROM`
- Optional `ACCOMMODATION_ADAPTER_URL`, `ACCOMMODATION_ADAPTER_TOKEN`
- Optional `SONGA_ENABLE_GLOBAL_MAP` (keep false until provider permissions and costs are confirmed)

Supabase normally injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into Edge Functions. Verify the project environment; never expose the service-role key to Vercel's browser build.

### AirHelp

The current app uses a TradeTracker affiliate destination URL embedded in the UI. It does not read an AirHelp API key from the environment. Affiliate attribution and claim conversion must be tested separately; do not represent the referral as an in-app compensation decision or claim submission.

## What the release actually contains

- Guest flight-number search routed through Supabase `flight-search` to AeroAPI.
- Supabase Auth and account-scoped Flight Watch.
- Flight details, disruption views, Live Desk and airport board screens.
- Songa AI Edge Function using Groq primary and Gemini fallback, with usage controls.
- PayPal Orders v2 endpoints: legacy flight assistance and shared commerce products.
- Commerce product families: Premium 30/365-day prepaid pass, Trip Rescue, Family & Group Watch, Gift Watch and NBO Airside Sandbox menu.
- WhatsApp companion and Twilio Edge Functions.
- Accommodation adapter contract, with live supplier booking disabled until a contracted adapter is connected.

## Truthful readiness matrix

| Requirement / judge lens | Evidence in source | Status before external tests |
|---|---|---|
| Technical implementation | React/Vite/TypeScript, Supabase functions, AeroAPI, Groq/Gemini, PayPal Orders v2 | Implemented; runtime integration tests required |
| Design and usability | Responsive Songa 2.0 shell, mobile navigation, light/dark styles, Stitch references reconciled into real React screens | Source polished; device/browser visual QA required |
| Innovation | Flight Watch + AI disruption guidance + shared commerce catalogue and WhatsApp entry points | Strong concept; prove workflows live in demo |
| Potential impact | Reduces risk of travellers missing flight changes; assistance and AirHelp referral | Explain impact without claiming guaranteed alerts or compensation |
| Presentation | Authentic first-flight story, live product demo, under-three-minute video | Owner recording/editing still required |
| PayPal commerce | Sandbox/live mode switch via Edge Function secrets; server-side order/capture/webhook logic | Sandbox transaction and webhook tests still required |
| Security | Provider secrets server-side, Supabase RLS and webhook verification patterns | Audit policies, keys, and test cross-user access |
| Agentic commerce | AI can guide product selection; server-side catalogue validates product/price; PayPal approval/capture precedes entitlement | Do not claim autonomous purchase; buyer explicitly approves checkout |

## Hard limits — do not claim these as live

- No airline ticketing/rebooking: AeroAPI is flight information, not a booking inventory or ticketing provider.
- No real Airside merchant inventory or airport fulfilment: menu is a sandbox demonstration.
- No accommodation inventory/reservation until a supplier adapter is contracted and verified.
- WhatsApp delivery and alert worker compatibility require schema and sender tests; the current legacy worker references older table names.
- A UI design, static build, or successful smoke script does not prove a real database write or successful payment.

## Judge-ready acceptance tests

1. Search a real flight number and date; show provider source and last update.
2. Sign in, save Flight Watch, refresh, remove; verify record and account isolation in Supabase.
3. Ask Songa AI about the selected flight; confirm it uses supplied provider context and does not invent facts.
4. Buy one low-cost Sandbox product; approve on PayPal; verify capture, webhook signature, order ledger and entitlement.
5. Replay a webhook and verify no duplicate fulfilment.
6. Test payment cancellation, declined payment, wrong amount/currency and unauthenticated capture.
7. Test at 320, 360, 390, 430, 768 and 1440 px; test both themes and keyboard focus.
8. Record a public/unlisted demo under three minutes and provide a README, MIT licence, setup instructions and test access to judges.

## Laptop power note

If the laptop continues to shut down while connected to a phone charger, stop repeated boot attempts. A phone USB-C charger may not supply the wattage or USB-PD profile the laptop requires. Use the original laptop-rated USB-C PD charger if available. Once stable, run the single PowerShell build script above.
