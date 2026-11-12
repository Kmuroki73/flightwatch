# Songa AI 2.0 — Source Release Candidate

Songa AI 2.0 is a mobile-first travel companion built around guest flight search, persistent Flight Watch, flight disruption context, AI-assisted travel guidance and a shared PayPal Sandbox commerce engine.

This archive is the **complete source project** for local development in PowerShell. It intentionally excludes `node_modules/`, local `.env` files and any previous generated `dist/` directory. Run the standard Vite build locally to create a fresh, bundled `dist/` folder.

## Main experience

- Orange-led, search-first application with responsive mobile layout.
- Guest flight search and debounced flight-number lookup.
- Flight results from the configured provider; unavailable fields are not fabricated.
- Existing Supabase authentication and Flight Watch adapter.
- My Songa dashboard for saved flights, recent searches, entitlements and purchase history.
- WhatsApp `SERVICES` and `MYSONGA` commands that use the same Commerce catalogue and account records; checkout is completed securely on the web app.
- Airport boards, disruption views, workspace screens and existing WhatsApp companion screens.
- AI assistant through a server-side Supabase Edge Function with Groq as primary LLM (`openai/gpt-oss-20b`) and Gemini 2.5 Flash as provider fallback. It can search live flights and retrieve the exact server-defined Songa commerce catalogue, then guide the traveller to the secure checkout screen. The buyer must explicitly approve PayPal checkout; the AI cannot create or capture a payment in chat.
- PayPal Orders v2 Sandbox payment endpoints and a shared Songa Commerce Engine for five product families.
- A JKIA / NBO Airside Sandbox catalogue. It creates test merchant orders and pickup references; it is not a live airport restaurant integration.
- Accommodation search UI backed by an authenticated provider-adapter Edge Function. Live inventory and reservations are disabled until a contracted supplier adapter is configured.
- A private traveller profile for display name, home airport, preferred currency and travel-interest tags, protected by Supabase row-level security.

## PayPal product families in the source

The shared catalogue is server-controlled in `supabase/functions/_shared/commerce.ts`:

| Product | Product ID | Sandbox amount | Fulfilment in this source |
|---|---|---:|---|
| Premium 30-day pass | `songa-premium-30` | USD 25.00 | 30-day entitlement |
| Premium 365-day pass | `songa-premium-365` | USD 250.00 | 365-day entitlement |
| Trip Rescue | `songa-trip-rescue` | USD 4.99 | Flight-specific AI assistance entitlement |
| Family & Group Watch | `songa-family-watch` | USD 9.99 | 14-day group workspace with up to five journey slots |
| Gift a Journey Watch | `songa-gift-watch` | USD 4.99 | 14-day gift entitlement and unique claim code |
| Airside order | `songa-airside-order` | Menu total | NBO Sandbox order and pickup reference |

There are five product families; Premium has two pass durations. Prices are test catalogue values and should be reviewed before any live commercial launch.

## Technology

- React 18, Vite 5 and TypeScript
- Supabase Auth, Postgres and Edge Functions
- AeroAPI/FlightAware integration through the existing `flight-search` function
- Groq Chat Completions + Gemini `generateContent` function calling through `songa-ai-assistant`
- PayPal Checkout Orders v2 Sandbox
- Existing Twilio WhatsApp integration (not yet certified end-to-end against the current Flight Watch schema)

## Run on Windows PowerShell

Read `POWERSHELL_START_HERE.md` first. For separate Sandbox and Live bundles, configure `.env.sandbox` and `.env.live`, then run `Set-ExecutionPolicy -Scope Process Bypass; .\BUILD-RELEASES.ps1`. The script produces separate deployable ZIPs. See `DUAL-DEPLOYMENT-AND-JUDGE-READINESS.md` for the exact architecture and judge acceptance matrix. In short:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run verify:milestone2
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

The build creates a normal Vite/Rollup production `dist/` folder. Use the generated `dist/` for Vercel after the checks pass.

## Environment configuration

Copy `.env.example` to `.env.local` and configure only browser-safe values locally:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or the Supabase publishable/anon key appropriate to the project)

All provider and payment credentials belong in Supabase Edge Function secrets, never in `VITE_*`, frontend files or GitHub:

- `AEROAPI_API_KEY` (or the provider-compatible `AEROAPI_KEY` used in the existing function)
- `GROQ_API_KEY`, `GEMINI_API_KEY`, optional `GROQ_MODEL`, `GEMINI_MODEL`, `SONGA_RATE_LIMIT_SALT`
- `PAYPAL_ENVIRONMENT=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID` for the existing per-flight assistance flow
- `PAYPAL_COMMERCE_WEBHOOK_ID` for the shared Commerce Engine
- `SONGA_APP_URL=https://songa.co.ke`
- Existing Twilio secrets, where already configured

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never expose the service-role key in the browser.

## Commerce and payment architecture

The website uses one shared Commerce Engine:

- `songa-commerce-create-order`
- `songa-commerce-capture-order`
- `songa-commerce-webhook`
- `songa-group-add-flight`
- `songa-join-group`
- `songa-redeem-gift`

The existing `paypal-create-order`, `paypal-capture-order` and `paypal-webhook` functions remain in the repository for the older flight-specific Premium Assistance flow. New product families should use the shared `songa-commerce-*` functions.

The server determines prices and products; the browser cannot set the amount. Payment is captured and checked on the server before a Songa entitlement or Airside order is issued. Webhook signature verification and idempotency should be tested in the Sandbox before any production use.

## Supabase migrations — review before applying

- `supabase/migrations/20261108000100_songa_payments_and_ai.sql`
- `supabase/migrations/20261109000100_songa_shared_commerce.sql`

The shared Commerce migration adds isolated Songa commerce, entitlement, group, Airside and webhook tables. It is designed not to alter existing Flight Watch tables. Nevertheless, inspect the live Supabase schema, take a backup and review the SQL before applying either migration. Do not run all historical migrations, `db reset` or a blind `db push` against the production project.

The current frontend Flight Watch adapter uses `flight_watches` joined to `flights`. Older historical migrations and the existing WhatsApp alert worker still refer to `watched_flights`. Reconcile this against the live database before enabling scheduled WhatsApp alerts.

## Important release limitations

- The TypeScript source transpilation and dependency-free Milestone 2 smoke check passed. A fresh dependency install did not complete in the packaging environment, so run `npm.cmd ci`, `npm.cmd run typecheck`, `npm.cmd run lint` and `npm.cmd run build` locally before deployment.
- No Supabase migration or Edge Function in this archive has been deployed to the live project as part of packaging.
- No PayPal Sandbox transaction has been completed from this environment; credentials and webhook registration must be configured and tested by the project owner.
- The AI endpoint requires a Groq and/or Gemini API key in Supabase Edge Function secrets.
- WhatsApp remains the existing Twilio integration. Its worker/schema compatibility and actual sender delivery must be verified before promising automated alerts.
- The global map endpoint is disabled unless explicitly enabled. Confirm AeroAPI plan permissions and costs before enabling commercial B2C map usage.
- Airside is a clearly labelled Sandbox merchant demo at NBO/JKIA. It does not represent a real airport restaurant, stock system, collection counter or fulfilment partner.
- The app does not issue airline tickets or independently rebook flights. Actual booking requires a booking-provider integration.

## Licence

The original Songa application source is released under MIT in `LICENSE`. Third-party libraries, brands, provider data, logos and externally supplied assets remain subject to their owners' terms and licences.

## Accommodation provider adapter

See `ACCOMMODATION_PROVIDER_CONTRACT.md` for the normalized search contract and the required supplier hold/confirm/cancel capabilities before a live PayPal hotel-booking flow can be enabled.

The Accommodation section sends searches to `songa-accommodation-search`. Configure `ACCOMMODATION_ADAPTER_URL` and `ACCOMMODATION_ADAPTER_TOKEN` as Supabase Edge Function secrets only after selecting a supplier. The provider adapter must accept the normalized search request and return validated offers. No sample hotels are fabricated. Hotel booking and PayPal charging are intentionally not enabled until a supplier supports a confirmed hold/booking, cancellation and refund workflow.

## Personalisation

After applying `supabase/migrations/20261111000200_songa_traveller_personalisation.sql`, signed-in users can save a display name, home airport, preferred currency and travel-interest tags in their own RLS-protected profile. The migration must be applied before the account preference form can save.
