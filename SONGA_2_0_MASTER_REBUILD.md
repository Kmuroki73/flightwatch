# Songa 2.0 Master Rebuild — implementation record

## Working base

This rebuild is based on `songa-2.0-uk-first-global`, not an older Stitch mock-up branch. It retains the existing Vite/React application, Supabase authentication and Flight Watch adapters, AeroAPI/FlightAware edge search, AI companion, disruption analysis, WhatsApp companion, traveller workspace and server-priced PayPal Commerce endpoints.

## Product direction

- UK-first passenger acquisition and rights education, with country-aware/global journey context.
- Dark-first aviation interface using the Stitch Obsidian palette: canvas `#0D0E11`, surface `#121316`, elevated surface `#1B1B1F`, accent `#FF5E1E`, emerald `#10B981`.
- Mobile-first navigation and touch targets, with a persistent bottom dock on phones.
- Personalisation is opt-in and account scoped; the home screen can read the signed-in traveller's own display name and home airport from `songa_traveller_profiles`.
- Weather/location is consent-led and displayed as local surface weather with WeatherAPI attribution. Manual city/airport input remains available.
- Flight status, gate/time/delay values and aircraft positions must remain sourced from the configured provider. Missing values must remain unavailable rather than being filled with design mock values.
- Passenger-rights guidance is kept inside Songa. An external AirHelp affiliate action is not exposed until partner coverage is confirmed from the live partner account.

## Traveller functionality already present in the application

- Guest flight search and live-provider result mapping, with a clearly labelled demo fallback only when the provider is not configured.
- Auth, Google/email sign-in, persistent Flight Watch, recent searches and traveller account preferences.
- Flight details, disruption analysis, rights guidance, saved-flight live desk, airport-board UI, Songa AI assistant and WhatsApp companion.
- Trip workspace, vault/expense module, group watch, gift entitlements, premium passes and server-priced PayPal Orders v2 checkout.
- NBO Airside is a sandbox merchant demonstration; accommodation search is an adapter surface pending a contracted provider.

## This rebuild commit

- Makes the existing traveller-context weather/location module visible on the primary home experience.
- Adds a profile-aware signed-in welcome and home-airport context without exposing email addresses or requesting device location automatically.
- Replaces an unverified hard-coded AirHelp referral jump with Songa's own passenger-rights/disruption flow.
- Adds the Stitch-inspired dark-first visual layer and refines the homepage, header, cards, weather panel, mobile dock, safe-area spacing and focus states.
- Leaves existing search, watchlist, AI, PayPal, WhatsApp and Supabase function contracts intact.

## Not yet a verified production capability

Stitch merchant operations, apron runner/dispatch, inventory, merchant settlement, dispute console, full admin command centre, smart calendar and soundtrack screens are still design references, not live roles/services in this app. They need real role policies, database schema, audit trail, payment/fulfilment states and contracted integrations before their controls can be represented as operational.

PayPal source currently uses Sandbox configuration until a live merchant app, live secrets, production webhook and a successful charge/refund test are confirmed. Airside and accommodation are not represented as live fulfilment. WhatsApp automated alerts need the existing watchlist/worker schema mismatch reconciled. Aircraft-position map coverage remains provider-plan-dependent. Weather requires the WeatherAPI secret and deployed `songa-weather` function.

## Required acceptance checks before production promotion

1. GitHub Actions: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`.
2. Preview/browser QA at 320, 360, 390, 430, 768, 1024 and 1440px; check dark and light theme.
3. Supabase auth, Google OAuth redirect, personalisation read/write (after migration), Flight Watch add/reload/remove and RLS isolation.
4. Provider-backed flight search, no-match, timeouts, stale/unavailable data and airport coverage.
5. AI requests, rate limits and tool responses; WhatsApp verification and real message delivery; monitor schema compatibility before automated alerts.
6. PayPal Sandbox create/approve/capture/cancel/webhook duplicate/retry/refund and entitlement fulfilment. Keep live mode disabled until this passes.
7. WeatherAPI consent, manual location fallback, attribution, timeout and quota handling.
8. Confirm live AirHelp market coverage and tracking terms before any referral action.
9. Verify Vercel Preview environment variables and deployment, then promote to Production only after sign-off.

No production Supabase migration, Edge Function deployment, PayPal live switch or Vercel Production promotion is performed by this source commit.
